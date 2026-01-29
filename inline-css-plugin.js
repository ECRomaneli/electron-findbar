const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const CleanCSS = require('clean-css');

const isDev = process.env.NODE_ENV === 'development';

/**
 * Plugin to inject CSS directly into HTML during webpack emit
 * Reads src/app.css and injects it inside <style> tag in HTML with SHA256 hash in CSP
 */
class InlineCssPlugin {
  apply(compiler) {
    compiler.hooks.emit.tap('InlineCssPlugin', (compilation) => {
      // Path to the source CSS file
      const srcCssFile = path.join(compiler.context, 'src/app.css');
      const htmlAsset = compilation.assets['index.html'];

      if (!fs.existsSync(srcCssFile)) {
        console.error('❌ CSS source file not found:', srcCssFile);
        return;
      }

      if (!htmlAsset) {
        console.error('❌ HTML asset not found');
        return;
      }

      try {
        // Read CSS
        let css = fs.readFileSync(srcCssFile, 'utf-8');

        // Minify CSS if not in development
        if (!isDev) {
          const minified = new CleanCSS().minify(css);
          if (minified.errors && minified.errors.length > 0) {
            console.error('❌ CSS minification errors:', minified.errors);
            return;
          }
          css = minified.styles || css;
        }

        // Calculate SHA256 hash of CSS for CSP
        const hash = crypto.createHash('sha256').update(css).digest('base64');
        const cspHash = `'sha256-${hash}'`;

        // Read HTML
        let html = htmlAsset.source().toString();

        // Inject CSS inside <style> tag before </head>
        html = html.replace('</head>', `<style>${css}</style></head>`);

        // Remove any CSS link tag if it exists
        html = html.replace(/<link[^>]*href=["'].*\.css["'][^>]*>/gi, '');

        // Update CSP meta tag to include the CSS hash
        html = html.replace(
          /style-src 'self'/,
          `style-src 'self' ${cspHash}`
        );

        // Update asset
        compilation.assets['index.html'] = {
          source: () => html,
          size: () => html.length,
        };

        console.log('✓ CSS inlined into HTML');
        console.log(`✓ CSP updated with style hash: ${cspHash}`);
      } catch (error) {
        console.error('❌ InlineCssPlugin error:', error.message);
      }
    });
  }
}

module.exports = InlineCssPlugin;
