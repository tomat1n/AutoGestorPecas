let CHECKLIST_INITIALIZED = false;

function initChecklistOnce() {
  if (CHECKLIST_INITIALIZED) return;
  CHECKLIST_INITIALIZED = true;
  window.CHK_STATE = { photos: [] };

  const photoInput = document.getElementById('chkPhotoInput');
  if (photoInput) {
    photoInput.addEventListener('change', (e) => {
      const files = e.target.files;
      if (!files || !files.length) return;
      addPhotos(files);
      // reset input to allow same file selection again
      e.target.value = '';
    });
  }

  const saveBtn = document.getElementById('chkSaveBtn');
  if (saveBtn) saveBtn.addEventListener('click', saveChecklist);

  const pdfBtn = document.getElementById('chkSavePdfBtn');
  if (pdfBtn) pdfBtn.addEventListener('click', exportChecklistToPDF);

  const filterType = document.getElementById('chkFilterType');
  if (filterType) filterType.addEventListener('change', renderChecklistList);

  renderPhotos();
  renderChecklistList();
}

function addPhotos(fileList) {
  const files = Array.from(fileList);
  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        window.CHK_STATE.photos.push(reader.result);
        renderPhotos();
      } catch (err) {
        console.error('Erro ao adicionar foto:', err);
      }
    };
    reader.readAsDataURL(file);
  });
}

function renderPhotos() {
  const grid = document.getElementById('chkPhotoGrid');
  if (!grid) return;
  const photos = window.CHK_STATE.photos || [];
  if (!photos.length) {
    grid.innerHTML = '<p style="color:#6b7280;">Nenhuma foto adicionada.</p>';
    return;
  }
  grid.innerHTML = photos.map((src, idx) => `
    <div class="photo-item">
      <img src="${src}" alt="foto ${idx + 1}">
      <button class="photo-remove" data-idx="${idx}" title="Remover">&times;</button>
    </div>
  `).join('');

  grid.querySelectorAll('.photo-remove').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      const i = Number(ev.currentTarget.dataset.idx);
      window.CHK_STATE.photos.splice(i, 1);
      renderPhotos();
    });
  });
}

function getChecklists() {
  try { return JSON.parse(localStorage.getItem('checklists') || '[]'); }
  catch { return []; }
}

function setChecklists(arr) {
  localStorage.setItem('checklists', JSON.stringify(arr));
}

function saveChecklist() {
  const type = val('chkVehicleType') || 'carro';
  const plate = val('chkPlate');
  const model = val('chkModel');
  const color = val('chkColor');

  const items = {
    lightsIssue: checked('chkLightsIssue'),
    lightsNotes: val('chkLightsNotes'),
    panelWarn: checked('chkPanelWarn'),
    panelNotes: val('chkPanelNotes'),
    bodyDamage: checked('chkBodyDamage'),
    bodyNotes: val('chkBodyNotes')
  };

  const notes = val('chkNotes');
  const photos = (window.CHK_STATE.photos || []).slice();
  const createdAt = new Date().toISOString();
  const id = Date.now();
  const entry = { id, type, plate, model, color, items, notes, photos, createdAt };

  const list = getChecklists();
  list.unshift(entry);
  setChecklists(list);

  window.CHK_STATE.photos = [];
  renderPhotos();
  renderChecklistList();
  alert('Checklist salvo.');
}

function renderChecklistList() {
  const el = document.getElementById('chkList');
  if (!el) return;
  const list = getChecklists();
  const filter = document.getElementById('chkFilterType')?.value || '';
  const filtered = filter ? list.filter((c) => c.type === filter) : list;

  if (!filtered.length) {
    el.innerHTML = '<p style="color:#6b7280;">Nenhum checklist salvo.</p>';
    return;
  }

  el.innerHTML = filtered.map((c) => {
    const flags = (c.items.lightsIssue ? 1 : 0) + (c.items.panelWarn ? 1 : 0) + (c.items.bodyDamage ? 1 : 0);
    const photoCount = c.photos?.length || 0;
    return `
      <div style="padding:8px;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
        <div>
          <strong>${escapeHTML(c.plate || '(sem placa)')}</strong> • ${escapeHTML(c.type)}<br>
          <small>${new Date(c.createdAt).toLocaleString()} • Avarias: ${flags} • Fotos: ${photoCount}</small>
        </div>
      </div>
    `;
  }).join('');
}

function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function checked(id) { const el = document.getElementById(id); return !!(el && el.checked); }
function escapeHTML(s) {
  return String(s || '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

// Inicialização segura ao carregar a página
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('checklistSection')) initChecklistOnce();
  });
} else {
  if (document.getElementById('checklistSection')) initChecklistOnce();
}

function exportChecklistToPDF() {
  try {
    const area = document.querySelector('#checklistSection .os-left') || document.getElementById('checklistSection');
    if (!area) { alert('Não foi possível localizar o conteúdo do checklist.'); return; }

    const plate = val('chkPlate') || 'sem-placa';
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `Checklist-${plate}-${dateStr}.pdf`;

    const run = async () => {
      const canvas = await html2canvas(area, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const { jsPDF } = window.jspdf || {};
      if (!jsPDF) {
        // Fallback: abrir diálogo de impressão
        window.print();
        return;
      }
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = canvas.height * imgWidth / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - margin * 2);

      while (heightLeft > 0) {
        pdf.addPage();
        position = margin - heightLeft;
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= (pageHeight - margin * 2);
      }

      pdf.save(fileName);
    };

    run();
  } catch (err) {
    console.error('Erro ao gerar PDF do checklist:', err);
    alert('Falha ao gerar PDF. Tente novamente. Como alternativa, use Ctrl+P e salve como PDF.');
  }
}