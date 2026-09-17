document.addEventListener("DOMContentLoaded", function () {
  var form = document.getElementById("import-form");
  var result = document.getElementById("import-result");
  if (!form) return;

  var csrfMeta = document.querySelector('meta[name="csrf-token"]');
  var csrfToken = csrfMeta ? csrfMeta.content : "";

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    var file = form.file.files[0];
    if (!file) return;
    var text = await file.text();
    var backup;
    try {
      backup = JSON.parse(text);
    } catch {
      result.textContent = "El archivo no es un JSON válido.";
      return;
    }
    var res = await fetch("/settings/backup/import", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify({ backup: backup }),
    });
    var data = await res.json();
    result.textContent = JSON.stringify(data, null, 2);
  });
});
