document.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && ['s', 'u', 'p'].includes(k)) {
    e.preventDefault();
  }
});
