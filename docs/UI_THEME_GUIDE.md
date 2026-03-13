# UI Theme Guide

## Overview

The UI theme system provides a flexible theming infrastructure for the city-building/hacking game, allowing users to customize the visual appearance while maintaining accessibility. This guide covers the theme architecture, available themes, and customization options.

## Theme Architecture

### CSS Variables

The theme system uses CSS custom properties (variables) for dynamic styling. All theme-related colors and values are defined as CSS variables on the `:root` element:

```css
:root {
    /* Primary colors */
    --primary-color: #00d4ff;
    --accent-color: #ff00ff;
    
    /* Text colors */
    --text-primary: #e0e0e0;
    --text-secondary: #a0a0a0;
    --text-muted: #606060;
    
    /* Background colors */
    --bg-primary: #1a1a2e;
    --bg-secondary: #16213e;
    --bg-tertiary: #0f3460;
    
    /* Accessibility */
    --font-scale: 1.0;
    --reduced-motion: 0;
    --high-contrast: 0;
}
```

### Theme Manager

The [`ThemeManager`](src/ui/theme.js:1) class handles theme application and accessibility settings:

```javascript
import { createThemeManager } from './ui/theme.js';

const themeManager = createThemeManager();

// Apply a theme
themeManager.setTheme('NEO_NOIR');

// Adjust accessibility settings
themeManager.setFontScale(1.2);
themeManager.setReducedMotion(true);
themeManager.setHighContrast(false);
```

## Available Themes

### 1. Neo Noir (Default)

A dark, cyberpunk-inspired theme with neon accents.

- **Primary Color**: `#00d4ff` (cyan)
- **Accent Color**: `#ff00ff` (magenta)
- **Background**: `#1a1a2e` (dark blue)
- **Best for**: Default gameplay, night scenes

### 2. Stardrew

A softer, dreamy theme with pastel colors.

- **Primary Color**: `#ff6b9d` (pink)
- **Accent Color**: `#9d4edd` (purple)
- **Background**: `#2d1b4e` (dark purple)
- **Best for**: Relaxed gameplay, aesthetic preference

### 3. Cyberpunk

High-contrast theme with aggressive neon colors.

- **Primary Color**: `#00ff41` (terminal green)
- **Accent Color**: `#f5e050` (yellow)
- **Background**: `#0d0221` (very dark purple)
- **Best for**: Hacking operations, intense gameplay

### 4. Minimal

Clean, monochromatic theme for focused gameplay.

- **Primary Color**: `#4a9eff` (blue)
- **Accent Color**: `#888888` (gray)
- **Background**: `#1a1a1a` (dark gray)
- **Best for**: Minimalist preference, reduced visual noise

## Accessibility Settings

### Font Scale

Adjusts the size of all UI text elements.

```javascript
// Range: 0.8 to 1.5
themeManager.setFontScale(1.2); // 20% larger text
```

**Impact**:
- All text elements scale proportionally
- Layouts adjust automatically
- Recommended for users with visual impairments

### Reduced Motion

Disables or reduces animations for users sensitive to motion.

```javascript
themeManager.setReducedMotion(true);
```

**Impact**:
- Transitions become instant
- Particle effects are simplified
- Screen shake is disabled
- Recommended for users with vestibular disorders

### High Contrast

Increases color contrast for better visibility.

```javascript
themeManager.setHighContrast(true);
```

**Impact**:
- Text colors become more saturated
- Background contrast is increased
- Subtle visual effects are enhanced
- Recommended for users with color vision deficiencies

## Customization

### Creating Custom Themes

To add a new theme, extend the `THEMES` object in [`src/ui/theme.js`](src/ui/theme.js:1):

```javascript
export const THEMES = {
    // ... existing themes
    CUSTOM: {
        name: 'Custom Theme',
        colors: {
            primary: '#your-color',
            accent: '#your-accent',
            textPrimary: '#your-text',
            bgPrimary: '#your-bg',
            // ... other colors
        }
    }
}
```

### Theme Persistence

Themes are automatically saved to localStorage and restored on game load. The current theme is stored in the game settings:

```javascript
// Access current theme
const currentTheme = settings.get('theme'); // e.g., 'NEO_NOIR'

// Change theme via settings
settings.set('theme', 'CYBERPUNK');
```

## Implementation Details

### Theme Application Process

1. **Theme Selection**: User selects a theme via settings UI
2. **CSS Variable Update**: Theme manager updates CSS variables on `:root`
3. **DOM Update**: All elements using CSS variables automatically update
4. **Persistence**: Theme preference is saved to localStorage

### Performance Considerations

- Theme changes are instant (no page reload)
- CSS variables are hardware-accelerated
- No JavaScript overhead after initial application
- Minimal memory footprint

### Browser Compatibility

- CSS Custom Properties: All modern browsers (Chrome 49+, Firefox 31+, Safari 9+)
- Fallback: Neo Noir theme colors are defined as defaults

## Best Practices

### For Developers

1. **Always use CSS variables** for themeable colors
2. **Test with all themes** before committing UI changes
3. **Verify accessibility** with high contrast and reduced motion enabled
4. **Document new colors** in this guide when adding themeable elements

### For Users

1. **Choose a theme** that reduces eye strain during long sessions
2. **Adjust font scale** if UI text is difficult to read
3. **Enable reduced motion** if animations cause discomfort
4. **Use high contrast** in bright environments or if colors appear washed out

## Troubleshooting

### Theme Not Applying

1. Check browser console for errors
2. Verify localStorage is enabled
3. Try resetting to default theme in settings

### Colors Look Wrong

1. Check if high contrast is enabled
2. Verify browser doesn't have forced colors enabled
3. Try a different theme to isolate the issue

### Text Too Small/Large

1. Adjust font scale in settings (0.8 to 1.5)
2. Check browser zoom level (Ctrl/Cmd + +/-)
3. Verify display scaling settings in OS

## References

- [Theme Manager Source](src/ui/theme.js:1)
- [Settings Manager](src/ui/settings.js:1)
- [CSS Variables](src/style.css:1)
- [Implementation Plan](implementation_plan.md:1)
