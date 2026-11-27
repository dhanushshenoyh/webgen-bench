(function(){
  if(window.__dcaInit)return;window.__dcaInit=true;
  function q(s){return document.querySelector(s)}
  function close(focus){var b=q('.menu-toggle'),n=q('#site-nav');if(!b||!n)return;b.setAttribute('aria-expanded','false');n.classList.remove('open');if(focus)b.focus()}
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('.menu-toggle');
    if(b){var open=b.getAttribute('aria-expanded')!=='true';b.setAttribute('aria-expanded',String(open));q('#site-nav').classList.toggle('open',open);if(open){var f=q('#site-nav a');f&&f.focus()}return}
    if(e.target.closest&&e.target.closest('#site-nav a'))close(false);
  });
  document.addEventListener('keydown',function(e){var b=q('.menu-toggle');if(e.key==='Escape'&&b&&b.getAttribute('aria-expanded')==='true'){close(true)}});
  window.addEventListener('resize',function(){if(window.innerWidth>900)close(false)});
  function enhance(){
    var path=location.pathname;var isContact=/contact(\.html)?\/?$/.test(path);
    document.querySelectorAll('#site-nav a').forEach(function(a){var c=/contact/.test(a.getAttribute('href'))&&isContact;c?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current')});
    var els=document.querySelectorAll('.reveal:not(.in)');
    if(!('IntersectionObserver' in window)||matchMedia('(prefers-reduced-motion: reduce)').matches){els.forEach(function(el){el.classList.add('in')});return}
    var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target)}})},{threshold:.12});
    els.forEach(function(el){io.observe(el)});
  }
  window.DemoClinicEnhance=enhance;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance);else enhance();
})();
