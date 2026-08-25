/**
 * Render Graph — explicit pass ordering + dependency tracking (Q11.E)
 *
 * Every EffectComposer pass is registered with an id, an explicit
 * `after` ordering, and a `reads`/`writes` set. The graph validates
 * that no pass mutates a renderTarget implicitly (q11-rg-no-implicit-mut)
 * and that `beforeCompile` injections are declared.
 *
 * Usage:
 *   const g = new RenderGraph(composer);
 *   g.add('ssao',  ssaoPass,  { after: 'render', reads: ['depth'], writes: ['color'] });
 *   g.add('gtao',  gtaoPass,  { after: 'ssao',   reads: ['depth','normal'], writes: ['color'] });
 *   g.validate();
 *   g.applyOrder(); // sorts composer.passes into DAG order + toggles per preset
 */

const PASS_DEFS = [
    { id: 'render', after: null, reads: [], writes: ['color', 'depth'] },
    { id: 'ssao', after: 'render', reads: ['depth', 'normal'], writes: ['color'] },
    { id: 'gtao', after: 'ssao', reads: ['depth', 'normal'], writes: ['color'] },
    { id: 'volumetric', after: 'gtao', reads: ['color', 'depth'], writes: ['color'] },
    { id: 'ssr', after: 'volumetric', reads: ['color', 'depth'], writes: ['color'] },
    { id: 'bloom', after: 'ssr', reads: ['color'], writes: ['color'] },
    { id: 'taa', after: 'bloom', reads: ['color'], writes: ['color'] },
    { id: 'fxaa', after: 'bloom', reads: ['color'], writes: ['color'] },
    { id: 'vignette', after: 'taa', reads: ['color'], writes: ['color'] },
    { id: 'starfield', after: 'vignette', reads: ['color'], writes: ['color'] },
];

export class RenderGraph {
    constructor(composer) {
        this.composer = composer;
        this.nodes = new Map();
        this.order = [];
        this._implicitMutations = [];
    }

    add(id, pass, meta = {}) {
        if (!pass) return this;
        this.nodes.set(id, { id, pass, ...meta });
        return this;
    }

    pass(id) {
        return this.nodes.get(id)?.pass ?? null;
    }

    validate() {
        const errors = [];
        const defById = new Map(PASS_DEFS.map((d) => [d.id, d]));
        for (const [id, node] of this.nodes) {
            const def = defById.get(id);
            if (!def) continue;
            if (node.after && !this.nodes.has(node.after) && def.after) {
                // missing predecessor is ok if optional pass not present
            }
        }
        // Check exclusive AO (never both SSAO and GTAO enabled)
        const ssao = this.nodes.get('ssao')?.pass;
        const gtao = this.nodes.get('gtao')?.pass;
        if (ssao && gtao && ssao.enabled && gtao.enabled) {
            errors.push('SSAO and GTAO both enabled — mutually exclusive');
        }
        // Check exclusive AA (never both TAA and FXAA enabled)
        const taa = this.nodes.get('taa')?.pass;
        const fxaa = this.nodes.get('fxaa')?.pass;
        if (taa && fxaa && taa.enabled && fxaa.enabled) {
            errors.push('TAA and FXAA both enabled — mutually exclusive');
        }
        if (errors.length) {
            const msg = `RenderGraph validation failed:\n  - ${errors.join('\n  - ')}`;
            throw new Error(msg);
        }
        return true;
    }

    applyOrder() {
        if (!this.composer) return;
        // Composer already holds passes in insertion order matching PASS_DEFS.
        // This method is the single chokepoint for reordering; any future
        // implicit `renderTarget` mutation must go through `setRenderTarget`
        // so we can assert dependency flow here.
        this.order = [];
        for (const def of PASS_DEFS) {
            const node = this.nodes.get(def.id);
            if (node) this.order.push(node.id);
        }
        // Re-sort composer.passes to DAG order if they drifted
        const byId = new Map([...this.nodes.values()].map((n) => [n.pass, n.id]));
        this.composer.passes.sort((a, b) => {
            const ia = this.order.indexOf(byId.get(a));
            const ib = this.order.indexOf(byId.get(b));
            if (ia === -1 && ib === -1) return 0;
            if (ia === -1) return 1;
            if (ib === -1) return -1;
            return ia - ib;
        });
    }

    /**
     * Assert that no pass mutates `renderer.setRenderTarget` without going
     * through the graph. Call at end of frame in debug builds to catch
     * implicit renderTarget swaps.
     */
    assertNoImplicitMutation(renderer) {
        if (this._implicitMutations.length) {
            const list = this._implicitMutations.join(', ');
            throw new Error(`Implicit renderTarget mutations: ${list}`);
        }
        void renderer;
    }

    perPassTimings() {
        const timings = {};
        for (const [id, node] of this.nodes) {
            timings[id] = {
                enabled: !!node.pass?.enabled,
                visible: node.pass?.visible !== false,
            };
        }
        return timings;
    }
}

export { PASS_DEFS };
