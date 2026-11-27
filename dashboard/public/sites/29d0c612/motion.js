/* motion-kit-v1 */
(function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var header = document.querySelector("[data-header]");
  function onScroll() { if (header) header.classList.toggle("is-scrolled", window.scrollY > 8); }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  if (reduce || !("IntersectionObserver" in window)) return;
  document.documentElement.classList.add("rp-motion");
  document.querySelectorAll("[data-stagger]").forEach(function (group) {
    var step = parseFloat(group.getAttribute("data-stagger")) || 0.08;
    Array.prototype.forEach.call(group.children, function (child, index) {
      if (!child.hasAttribute("data-reveal")) child.setAttribute("data-reveal", "");
      child.style.setProperty("--rp-delay", Math.min(index * step, 0.6) + "s");
    });
  });
  document.querySelectorAll("[data-split]").forEach(function (el) {
    var words = el.textContent.trim().split(/\s+/);
    if (!words.length || el.children.length) return;
    el.setAttribute("aria-label", el.textContent.trim());
    el.textContent = "";
    words.forEach(function (word, index) {
      var span = document.createElement("span");
      span.className = "rp-word";
      span.setAttribute("aria-hidden", "true");
      span.textContent = word;
      span.style.setProperty("--rp-delay", Math.min(index * 0.05, 0.8) + "s");
      el.appendChild(span);
      if (index < words.length - 1) el.appendChild(document.createTextNode(" "));
    });
  });
  function count(el) {
    var text = el.textContent;
    var match = text.match(/\d[\d,]*(?:\.\d+)?/);
    if (!match) return;
    var target = parseFloat(match[0].replace(/,/g, ""));
    var decimals = (match[0].split(".")[1] || "").length;
    var grouped = match[0].indexOf(",") > -1;
    var start = null;
    function frame(time) {
      if (start === null) start = time;
      var t = Math.min((time - start) / 1200, 1);
      var value = (target * (1 - Math.pow(1 - t, 3))).toFixed(decimals);
      if (grouped) value = Number(value).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      el.textContent = text.replace(match[0], t < 1 ? value : match[0]);
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      if (entry.target.hasAttribute("data-count")) count(entry.target);
      observer.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
  document.querySelectorAll("[data-reveal],[data-split],[data-count]").forEach(function (el) { observer.observe(el); });
  document.querySelectorAll("[data-spotlight]").forEach(function (el) {
    el.addEventListener("pointermove", function (event) {
      var box = el.getBoundingClientRect();
      el.style.setProperty("--mx", event.clientX - box.left + "px");
      el.style.setProperty("--my", event.clientY - box.top + "px");
    });
  });
  var parallax = Array.prototype.slice.call(document.querySelectorAll("[data-parallax]"), 0, 2);
  if (parallax.length) {
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        parallax.forEach(function (el) {
          var box = el.getBoundingClientRect();
          var offset = Math.max(-24, Math.min(24, (box.top + box.height / 2 - window.innerHeight / 2) * -0.06));
          el.style.transform = "translate3d(0," + offset.toFixed(1) + "px,0)";
        });
        ticking = false;
      });
    }, { passive: true });
  }
})();
