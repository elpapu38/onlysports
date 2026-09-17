document.addEventListener("DOMContentLoaded", function () {
  var btn = document.getElementById("nav-back");
  if (!btn) return;
  btn.addEventListener("click", function () {
    window.history.back();
  });
});
