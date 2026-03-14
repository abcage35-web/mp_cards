export interface LegacyStyleAsset {
  key: string;
  cssText?: string;
  href?: string;
}

export interface LegacyScriptAsset {
  key: string;
  type: string;
  code?: string;
  src?: string;
}

export interface LegacyPageDefinition {
  bodyHtml: string;
  styles: LegacyStyleAsset[];
  scripts: LegacyScriptAsset[];
  title: string;
}

const pageDefinitionCache = new Map<string, Promise<LegacyPageDefinition>>();
const styleLoadCache = new Map<string, Promise<void>>();
const scriptLoadCache = new Map<string, Promise<void>>();

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}

interface LegacyPageParseOptions {
  includeInlineScripts?: boolean;
}

function parseLegacyPage(html: string, shellUrl: string, options: LegacyPageParseOptions): LegacyPageDefinition {
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(html, "text/html");
  const bodyClone = documentNode.body.cloneNode(true) as HTMLBodyElement;

  bodyClone.querySelectorAll("script").forEach((node) => node.remove());

  const styles = Array.from(documentNode.head.querySelectorAll("style, link[rel='stylesheet']")).map((node) => {
    if (node.tagName === "STYLE") {
      const cssText = node.textContent || "";
      return {
        key: `inline-style-${hashString(cssText)}`,
        cssText,
      } satisfies LegacyStyleAsset;
    }

    const href = (node as HTMLLinkElement).getAttribute("href") || "";
    const resolvedHref = new URL(href, shellUrl).toString();

    return {
      key: `style-${hashString(resolvedHref)}`,
      href: resolvedHref,
    } satisfies LegacyStyleAsset;
  });

  const scripts = Array.from(documentNode.querySelectorAll("script"))
    .map((node) => {
      const src = node.getAttribute("src");
      const type = node.getAttribute("type") || "text/javascript";

      if (src) {
        const resolvedSrc = new URL(src, shellUrl).toString();
        return {
          key: `script-${hashString(resolvedSrc)}`,
          type,
          src: resolvedSrc,
        } satisfies LegacyScriptAsset;
      }

      const code = node.textContent || "";
      return {
        key: `inline-script-${hashString(code)}`,
        type,
        code,
      } satisfies LegacyScriptAsset;
    })
    .filter((script) => options.includeInlineScripts !== false || Boolean(script.src));

  return {
    bodyHtml: bodyClone.innerHTML,
    styles,
    scripts,
    title: documentNode.title || "",
  };
}

export async function getLegacyPageDefinition(
  shellUrl: string,
  options: LegacyPageParseOptions = {},
): Promise<LegacyPageDefinition> {
  const includeInlineScripts = options.includeInlineScripts !== false;
  const cacheKey = `${shellUrl}::inline=${includeInlineScripts ? "yes" : "no"}`;

  if (!pageDefinitionCache.has(cacheKey)) {
    pageDefinitionCache.set(
      cacheKey,
      fetch(shellUrl, { cache: "no-store" }).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch legacy shell: ${response.status}`);
        }

        const html = await response.text();
        return parseLegacyPage(html, response.url || shellUrl, options);
      }),
    );
  }

  return pageDefinitionCache.get(cacheKey)!;
}

function ensureStyleAsset(style: LegacyStyleAsset) {
  if (!styleLoadCache.has(style.key)) {
    styleLoadCache.set(
      style.key,
      new Promise<void>((resolve, reject) => {
        if (style.href) {
          if (document.head.querySelector(`link[data-legacy-style-key="${style.key}"]`)) {
            resolve();
            return;
          }

          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = style.href;
          link.dataset.legacyStyleKey = style.key;
          link.onload = () => resolve();
          link.onerror = () => reject(new Error(`Failed to load stylesheet: ${style.href}`));
          document.head.appendChild(link);
          return;
        }

        if (document.head.querySelector(`style[data-legacy-style-key="${style.key}"]`)) {
          resolve();
          return;
        }

        const styleNode = document.createElement("style");
        styleNode.dataset.legacyStyleKey = style.key;
        styleNode.textContent = style.cssText || "";
        document.head.appendChild(styleNode);
        resolve();
      }).catch((error) => {
        styleLoadCache.delete(style.key);
        throw error;
      }),
    );
  }

  return styleLoadCache.get(style.key)!;
}

function ensureScriptAsset(script: LegacyScriptAsset) {
  if (!scriptLoadCache.has(script.key)) {
    scriptLoadCache.set(
      script.key,
      new Promise<void>((resolve, reject) => {
        if (script.src) {
          if (document.head.querySelector(`script[data-legacy-script-key="${script.key}"]`)) {
            resolve();
            return;
          }

          const scriptNode = document.createElement("script");
          scriptNode.src = script.src;
          scriptNode.type = script.type;
          scriptNode.async = false;
          scriptNode.dataset.legacyScriptKey = script.key;
          scriptNode.onload = () => resolve();
          scriptNode.onerror = () => reject(new Error(`Failed to load script: ${script.src}`));
          document.head.appendChild(scriptNode);
          return;
        }

        if (document.head.querySelector(`script[data-legacy-script-key="${script.key}"]`)) {
          resolve();
          return;
        }

        const scriptNode = document.createElement("script");
        scriptNode.type = script.type;
        scriptNode.dataset.legacyScriptKey = script.key;
        scriptNode.text = script.code || "";
        document.head.appendChild(scriptNode);
        resolve();
      }).catch((error) => {
        scriptLoadCache.delete(script.key);
        throw error;
      }),
    );
  }

  return scriptLoadCache.get(script.key)!;
}

export async function loadLegacyPageAssets(definition: LegacyPageDefinition) {
  await Promise.all(definition.styles.map((style) => ensureStyleAsset(style)));

  for (const script of definition.scripts) {
    await ensureScriptAsset(script);
  }
}
