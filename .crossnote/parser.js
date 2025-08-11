({
  // Please visit the URL below for more information:
  // https://shd101wyy.github.io/markdown-preview-enhanced/#/extend-parser

  onWillParseMarkdown: async function (markdown) {
    return markdown;
  },

  onDidParseMarkdown: async function (html) {
    return html;
  },
});

// 1. 处理侧边栏目录样式的脚本
const scripts = `
<script>
function setCurrent() {
  const links = document.querySelectorAll(".md-sidebar-toc a");
  for (const link of links) {
    link.style.color = "";
  }
  const hash = location.hash;
  const a = document.querySelector(\`a[href="\${hash}"]\`);
  if (a) {
    a.style.color = "#ff40";
  }
}
setCurrent();
window.onhashchange = setCurrent;
</script>
`;

// 2. markdown 解析逻辑
var fs = require("fs");
module.exports = {
  onWillParseMarkdown: function (markdown) {
    return new Promise((resolve, reject) => {
      const reg = /!\[\[(.*)]]\(\s*(.+?)\s*\)/gm;
      markdown = markdown.replace(reg, function (match, g1, g2) {
        var width = "100%";
        if (g1) {
          var w = g1.split("|");
          if (w.length > 1) {
            width = w[1] + "px";
            g1 = w[0];
          }
        }
        return `
<p class="markdown-p-center">
  <img src="${g2}" alt="${g1}" style="max-width:${width}"/>
</p>
<p class="markdown-img-description">
  ${g1}
</p>
`;
      });
      resolve(markdown);
    });
  },

  onDidParseMarkdown: function (html) {
    return new Promise((resolve, reject) => {
      return resolve(scripts + html);
    });
  },
};
