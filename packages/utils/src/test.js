export const testfn = (test) => {
  const dom = document.createElement("div");
  dom.innerHTML = test || "test";
  dom.style.color = "red";
  dom.style.fontSize = "20px";
  document.body.appendChild(dom);
  return dom;
};
