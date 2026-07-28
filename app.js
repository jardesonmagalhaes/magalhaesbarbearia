// CONFIGURAÇÕES DO SUPABASE
const SUPABASE_URL = "https://seu-projeto.supabase.co";
const SUPABASE_KEY = "sua-chave-anon-aqui";

// Conta configurada manualmente no Supabase para o login automático
const AUTH_EMAIL = "barbearia@admin.com"; 
const AUTH_PASS = "senha_secreta_123";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM Elements
const selectedDateInput = document.getElementById('selected-date');
const currentDateLabel = document.getElementById('current-date-label');
const appointmentsList = document.getElementById('appointments-list');
const metricCounts = document.getElementById('metric-counts');
const metricRevenue = document.getElementById('metric-revenue');

// Inicializa com a data de hoje
selectedDateInput.value = new Date().toISOString().split('T')[0];

async function init() {
  // Autenticação Automática Transparente (Sem tela de login para o pai)
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    await db.auth.signInWithPassword({ email: AUTH_EMAIL, password: AUTH_PASS });
  }
  loadAppointments();
}
init();

// Navegação de Datas
document.getElementById('btn-prev-day').addEventListener('click', () => changeDay(-1));
document.getElementById('btn-next-day').addEventListener('click', () => changeDay(1));
selectedDateInput.addEventListener('change', loadAppointments);
document.getElementById('btn-refresh').addEventListener('click', loadAppointments);

function changeDay(delta) {
  const d = new Date(selectedDateInput.value + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  selectedDateInput.value = d.toISOString().split('T')[0];
  loadAppointments();
}

// Carregar Agendamentos do Dia
async function loadAppointments() {
  appointmentsList.innerHTML = '<p style="text-align:center; color:#64748b; padding:20px;">Carregando...</p>';
  
  const dateStr = selectedDateInput.value;
  updateDateLabel(dateStr);

  const startOfDay = `${dateStr}T00:00:00.000Z`;
  const endOfDay = `${dateStr}T23:59:59.999Z`;

  const { data, error } = await db
    .from('agendamentos')
    .select('*')
    .gte('data_horario', startOfDay)
    .lte('data_horario', endOfDay)
    .order('data_horario', { ascending: true });

  if (error) {
    console.error(error);
    appointmentsList.innerHTML = '<p style="color:#ef4444; text-align:center;">Erro ao carregar agendamentos.</p>';
    return;
  }

  renderList(data || []);
}

function updateDateLabel(dateStr) {
  const parts = dateStr.split('-');
  currentDateLabel.textContent = `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// Renderização dos cards e cálculo das métricas
function renderList(list) {
  appointmentsList.innerHTML = '';
  let total = list.length;
  let concluidos = 0;
  let faturamento = 0;

  if (total === 0) {
    appointmentsList.innerHTML = `
      <div style="text-align: center; color: #64748b; padding: 40px 16px; background: #161e2e; border-radius: 12px; border: 1px dashed #1e293b;">
        Nenhum horário marcado para este dia.
      </div>`;
  } else {
    list.forEach(item => {
      if (item.status === 'concluido') concluidos++;
      if (item.status !== 'cancelado') faturamento += Number(item.valor || 0);

      const hora = new Date(item.data_horario).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const servicosTexto = item.servicos && item.servicos.length > 0 ? item.servicos.join(', ') : '';

      const card = document.createElement('div');
      card.className = `appointment-card ${item.status}`;
      
      card.innerHTML = `
        <div>
          <span class="time-tag">${hora}</span>
          <div class="client-name">${item.cliente_nome}</div>
          ${servicosTexto ? `<div class="services-text">✂️ ${servicosTexto} - R$ ${Number(item.valor).toFixed(2)}</div>` : ''}
          ${item.cliente_telefone ? `<div class="phone-text">📞 ${item.cliente_telefone}</div>` : ''}
        </div>
        
        <div class="card-actions">
          ${item.status === 'agendado' ? `
            <button onclick="openModalFinalizar('${item.id}', '${item.cliente_nome}')" class="btn-finish">Concluir</button>
            <button onclick="cancelarAtendimento('${item.id}')" class="btn-cancel" title="Cancelar">✕</button>
          ` : item.status === 'concluido' ? `
            <span style="color:#10b981; font-weight:bold; font-size:0.85rem;">Concluído</span>
          ` : `
            <span style="color:#ef4444; font-size:0.85rem;">Cancelado</span>
          `}
        </div>
      `;
      appointmentsList.appendChild(card);
    });
  }

  metricCounts.textContent = `${concluidos} / ${total}`;
  metricRevenue.textContent = `R$ ${faturamento.toFixed(2)}`;
}

// Modal Agendar
document.getElementById('btn-open-agendar').addEventListener('click', () => {
  document.getElementById('modal-agendar').classList.remove('hidden');
});

document.getElementById('form-agendar').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nome = document.getElementById('add-nome').value;
  const hora = document.getElementById('add-hora').value;
  const telefone = document.getElementById('add-telefone').value;
  const dateStr = selectedDateInput.value;

  const dataHoraIso = new Date(`${dateStr}T${hora}:00`).toISOString();

  const { error } = await db.from('agendamentos').insert([{
    cliente_nome: nome,
    cliente_telefone: telefone,
    data_horario: dataHoraIso,
    status: 'agendado'
  }]);

  if (error) alert('Erro ao agendar: ' + error.message);
  else {
    closeModal('modal-agendar');
    document.getElementById('form-agendar').reset();
    loadAppointments();
  }
});

// Modal Finalizar
window.openModalFinalizar = (id, nome) => {
  document.getElementById('finish-id').value = id;
  document.getElementById('finish-client-display').textContent = `Cliente: ${nome}`;
  
  // Limpa checkboxes
  document.querySelectorAll('#form-finalizar input[type="checkbox"]').forEach(c => c.checked = false);
  document.getElementById('finish-valor').value = '';

  document.getElementById('modal-finalizar').classList.remove('hidden');
};

document.getElementById('form-finalizar').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('finish-id').value;
  const valor = document.getElementById('finish-valor').value;

  // Pega todos os serviços marcados
  const servicosSelecionados = [];
  document.querySelectorAll('#form-finalizar input[type="checkbox"]:checked').forEach(c => {
    servicosSelecionados.push(c.value);
  });

  const { error } = await db.from('agendamentos').update({
    status: 'concluido',
    servicos: servicosSelecionados,
    valor: parseFloat(valor)
  }).eq('id', id);

  if (error) alert('Erro ao finalizar: ' + error.message);
  else {
    closeModal('modal-finalizar');
    loadAppointments();
  }
});

// Cancelar
window.cancelarAtendimento = async (id) => {
  if (confirm('Deseja cancelar este agendamento?')) {
    await db.from('agendamentos').update({ status: 'cancelado' }).eq('id', id);
    loadAppointments();
  }
};

window.closeModal = (modalId) => {
  document.getElementById(modalId).classList.add('hidden');
};
