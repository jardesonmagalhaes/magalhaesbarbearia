// CONFIGURAÇÃO DO SUPABASE (Substitua pelos seus dados)
const SUPABASE_URL = "https://okkokhexwjphohewkayz.supabase.co";
const SUPABASE_KEY = "sb_publishable_ziEfLEy_NjFL-zGQjevFKg_jYGboGJ8";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// Elementos do DOM
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const btnLogout = document.getElementById('btn-logout');

const selectedDateInput = document.getElementById('selected-date');
const btnPrevDay = document.getElementById('btn-prev-day');
const btnNextDay = document.getElementById('btn-next-day');
const btnRefresh = document.getElementById('btn-refresh');

const appointmentsList = document.getElementById('appointments-list');
const metricCounts = document.getElementById('metric-counts');
const metricRevenue = document.getElementById('metric-revenue');

const modal = document.getElementById('modal');
const btnOpenModal = document.getElementById('btn-open-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const appointmentForm = document.getElementById('appointment-form');

// Define data atual inicial (YYYY-MM-DD)
selectedDateInput.value = new Date().toISOString().split('T')[0];

// Inicialização e Auth Check
async function init() {
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    showApp();
  } else {
    showLogin();
  }
}
init();

// Login / Logout
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    alert('Erro ao entrar: ' + error.message);
  } else {
    showApp();
  }
});

btnLogout.addEventListener('click', async () => {
  await db.auth.signOut();
  showLogin();
});

function showLogin() {
  loginScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
}

function showApp() {
  loginScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  loadAppointments();
}

// Navegação de Datas
btnPrevDay.addEventListener('click', () => changeDay(-1));
btnNextDay.addEventListener('click', () => changeDay(1));
selectedDateInput.addEventListener('change', loadAppointments);
btnRefresh.addEventListener('click', loadAppointments);

function changeDay(delta) {
  const d = new Date(selectedDateInput.value + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  selectedDateInput.value = d.toISOString().split('T')[0];
  loadAppointments();
}

// Buscar dados no Supabase
async function loadAppointments() {
  appointmentsList.innerHTML = '<p style="text-align:center; color:#94a3b8;">Carregando...</p>';
  
  const dateStr = selectedDateInput.value;
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
    appointmentsList.innerHTML = '<p style="color:red;">Erro ao carregar os horários.</p>';
    return;
  }

  renderList(data || []);
}

// Renderizar Lista e Métricas
function renderList(list) {
  appointmentsList.innerHTML = '';

  let total = list.length;
  let concluidos = 0;
  let faturamento = 0;

  if (total === 0) {
    appointmentsList.innerHTML = `
      <div class="card" style="text-align: center; color: #64748b; padding: 32px 16px;">
        Nenhum horário agendado para este dia.
      </div>`;
  } else {
    list.forEach(item => {
      if (item.status === 'concluido') concluidos++;
      if (item.status !== 'cancelado') faturamento += Number(item.valor);

      const hora = new Date(item.data_horario).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const card = document.createElement('div');
      card.className = `card item-card ${item.status}`;
      card.innerHTML = `
        <div>
          <div>
            <span class="item-time">${hora}</span>
            <span class="item-name">${item.cliente_nome}</span>
          </div>
          <div class="item-details">
            ${item.servico} • <span class="item-price">R$ ${Number(item.valor).toFixed(2)}</span>
            ${item.cliente_telefone ? `<br>📞 ${item.cliente_telefone}` : ''}
          </div>
        </div>
        <div class="item-actions">
          ${item.status !== 'concluido' ? `<button onclick="updateStatus('${item.id}', 'concluido')" class="btn-icon" title="Concluir">✅</button>` : ''}
          ${item.status !== 'cancelado' ? `<button onclick="updateStatus('${item.id}', 'cancelado')" class="btn-icon" title="Cancelar">❌</button>` : ''}
        </div>
      `;
      appointmentsList.appendChild(card);
    });
  }

  // Atualiza métricas
  metricCounts.textContent = `${concluidos} / ${total}`;
  metricRevenue.textContent = `R$ ${faturamento.toFixed(2)}`;
}

// Atualizar Status (Concluído/Cancelado)
window.updateStatus = async (id, status) => {
  const { error } = await db.from('agendamentos').update({ status }).eq('id', id);
  if (error) alert('Erro ao atualizar: ' + error.message);
  else loadAppointments();
};

// Modal de Novo Agendamento
btnOpenModal.addEventListener('click', () => modal.classList.remove('hidden'));
btnCloseModal.addEventListener('click', () => modal.classList.add('hidden'));

appointmentForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('cust-name').value;
  const phone = document.getElementById('cust-phone').value;
  const service = document.getElementById('cust-service').value;
  const time = document.getElementById('cust-time').value;
  const price = document.getElementById('cust-price').value;
  const dateStr = selectedDateInput.value;

  const dataHoraIso = new Date(`${dateStr}T${time}:00`).toISOString();

  const { error } = await db.from('agendamentos').insert([{
    cliente_nome: name,
    cliente_telefone: phone,
    servico: service,
    valor: parseFloat(price),
    data_horario: dataHoraIso,
    status: 'agendado'
  }]);

  if (error) {
    alert('Erro ao salvar: ' + error.message);
  } else {
    modal.classList.add('hidden');
    appointmentForm.reset();
    loadAppointments();
  }
});

// Registrar Service Worker para PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(err => console.log('SW Fail:', err));
}
