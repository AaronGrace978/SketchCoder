const KEYWORDS =
  /\b(export|import|from|const|let|async|await|function|return|type|interface|class|if|else|for|while|new|try|catch|of|in|true|false|null|undefined|string|number|boolean)\b/g;

export function highlightCode(code: string): string {
  const escaped = code
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/(\/\/.*$)/gm, `<span class="text-muted">$1</span>`)
    .replace(/(&quot;.*?&quot;|&#39;.*?&#39;|`.*?`)/g, `<span class="text-brass">$1</span>`)
    .replace(KEYWORDS, `<span class="text-sage">$1</span>`);
}

export function treeFromPaths(paths: string[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const path of paths) {
    const parts = path.split("/");
    let level = root;
    let acc = "";
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      acc = acc ? `${acc}/${name}` : name;
      const isFile = i === parts.length - 1;
      let node = level.find((n) => n.name === name);
      if (!node) {
        node = { name, path: acc, children: isFile ? undefined : [] };
        level.push(node);
      }
      if (!isFile) level = node.children!;
    }
  }
  return root;
}

export type TreeNode = {
  name: string;
  path: string;
  children?: TreeNode[];
};
