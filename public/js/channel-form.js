document.addEventListener("DOMContentLoaded", function () {
  var toggle = document.getElementById("advanced-toggle");
  var standardSelect = document.getElementById("channel-type");
  var advancedWrapper = document.getElementById("advanced-warning");
  var advancedSelect = document.getElementById("advanced-type");
  if (!toggle) return;

  toggle.addEventListener("change", function () {
    var advanced = toggle.checked;

    advancedWrapper.classList.toggle("hidden", !advanced);
    advancedSelect.classList.toggle("hidden", !advanced);

    if (advanced) {
      standardSelect.removeAttribute("name");
      standardSelect.disabled = true;
      advancedSelect.disabled = false;
      advancedSelect.name = "type";
    } else {
      advancedSelect.removeAttribute("name");
      advancedSelect.disabled = true;
      standardSelect.disabled = false;
      standardSelect.name = "type";
    }
  });
});
