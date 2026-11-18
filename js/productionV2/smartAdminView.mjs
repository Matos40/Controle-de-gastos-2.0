import {accountLabel, filterAccounts} from './smartAdminIdentity.mjs';

const plans = {owner: 'Owner', admin: 'Admin', premium: 'Premium', free: 'Free'};
function el(tag, text = '', cls = '') {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = cls;
  return node;
}
function button(text, click) {
  const node = el('button', text, 'admin-action');
  node.type = 'button';
  node.onclick = click;
  return node;
}
function selector(label, options) {
  const node = el('select');
  node.setAttribute('aria-label', label);
  for (const [value, text] of options) {
    const option = el('option', text);
    option.value = value;
    node.append(option);
  }
  return node;
}
export function mountAdmin({api, role, uid}) {
  const host = document.getElementById('smartAdminHost');
  const open = document.getElementById('smartAdminOpen');
  let serial = 0, alive = true;
  const close = () => {
    serial++;
    host.querySelector('dialog')?.close();
    host.hidden = true;
    host.replaceChildren();
    const profile = open.closest('details');
    if (profile) profile.querySelector('summary')?.focus();
    else open.focus();
  };

  function edit(account, status, epoch) {
    const dialog = el('dialog', '', 'v345-dialog');
    const title = el('h2', 'Editar ' + accountLabel(account));
    title.id = 'v345EditTitle';
    dialog.setAttribute('aria-labelledby', title.id);
    const form = el('form', '', 'v345-edit');
    const plan = selector('Plano', [['free', 'Free'], ['premium', 'Premium']]);
    plan.value = account.plan;
    const blocked = selector('Situação', [['false', 'Ativa'], ['true', 'Bloqueada']]);
    blocked.value = String(account.blocked);

    const message = el('p');
    message.setAttribute('role', 'status');
    const cancel = button('Cancelar', () => dialog.close());
    const save = button('Salvar alterações');
    save.type = 'submit';
    form.append(plan, blocked, message, cancel, save);
    form.onsubmit = async event => {
      event.preventDefault();
      if (save.disabled || !alive || epoch!==serial) return;
      save.disabled = true;
      cancel.disabled = true;
      try {
        await api.change(account.uid, {plan: plan.value, blocked: blocked.value === 'true'});
        if (epoch === serial) {
          dialog.close();
          await load('Alterações salvas.');
        }
      } catch {
        message.textContent = 'A alteração foi recusada ou a conexão está indisponível.';
      } finally { save.disabled = false; cancel.disabled = false; }
    };
    dialog.addEventListener('close', () => dialog.remove(), {once: true});
    dialog.append(title, form);
    status.after(dialog);
    dialog.showModal();
  }

  async function load(message) {
    if(!alive)return;
    const epoch = ++serial;
    host.hidden = false;
    const status = el('p', 'Carregando…');
    status.setAttribute('role', 'status');
    const exit = button('Fechar', close);
    exit.classList.add('v345-admin-close');
    exit.textContent = '×';
    exit.setAttribute('aria-label', 'Fechar painel administrativo');
    const heading = el('div', '', 'v345-admin-heading');
    const title = el('div');
    title.append(el('h2', 'Smart Admin · ' + plans[role]), el('p', 'Gerenciamento de usuários e acesso', 'v345-admin-subtitle'));
    heading.append(title, exit);
    host.replaceChildren(heading, status);
    exit.focus();
    try {
      if (!await api.role()) throw Error('ADMIN_DENIED');
      const [accounts, audit] = await Promise.all([api.list(), api.audit()]);
      if (epoch !== serial) return;
      status.textContent = (typeof message === 'string' ? message + ' ' : '') + accounts.length + ' contas nesta amostra, até 100.';
      const stats = el('div', '', 'admin-stats');
      for (const [label, value] of [
        ['Usuários', accounts.length],
        ['Ativas', accounts.filter(a => !a.blocked).length],
        ['Bloqueadas', accounts.filter(a => a.blocked).length],
        ['Administradores', accounts.filter(a => a.role === 'owner' || a.role === 'admin').length],
        ['Free', accounts.filter(a => a.plan === 'free').length],
        ['Premium', accounts.filter(a => a.plan === 'premium').length],
      ]) {
        const card = el('div', '', 'admin-stat');
        card.append(el('small', label), el('strong', String(value)));
        stats.append(card);
      }
      const search = el('input');
      search.type = 'search';
      search.placeholder = 'Buscar nome ou e-mail';
      search.setAttribute('aria-label', 'Buscar contas');
      const plan = selector('Plano', [['', 'Todos os planos'], ['free', 'Free'], ['premium', 'Premium']]);
      const state = selector('Situação', [['', 'Todas as situações'], ['active', 'Ativas'], ['blocked', 'Bloqueadas']]);
      const tools = el('div', '', 'admin-tools');
      tools.append(search, plan, state);
      const rows = el('div');
      const render = () => {
        rows.replaceChildren();
        for (const account of filterAccounts(accounts, search.value, plan.value, state.value)) {
          const row = el('article', '', 'admin-row');
          row.dataset.plan = account.role || account.plan;
          const details = el('details');
          details.append(el('summary', 'Detalhes técnicos'), el('small', account.uid));
          const info = el('div', '', 'admin-info');
          const identity = el('div', '', 'v345-admin-identity');
          const initials = accountLabel(account).trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
          const avatar = el('span', initials, 'v345-admin-avatar');
          avatar.setAttribute('aria-hidden', 'true');
          const name = el('div', '', 'v345-admin-name');
          name.append(el('strong', accountLabel(account)));
          if (account.email) name.append(el('small', account.email));
          if(account.photo){try{const url=new URL(account.photo);if(url.protocol==='https:'&&/(^|\.)googleusercontent\.com$/.test(url.hostname)&&!url.username&&!url.password){const img=el('img');img.alt='';img.referrerPolicy='no-referrer';img.loading='lazy';img.onload=()=>avatar.replaceChildren(img);img.src=url.href;}}catch{}}
          identity.append(avatar, name);
          const tags = el('div', '', 'v345-admin-tags');
          tags.append(el('span', plans[row.dataset.plan]||'Conta', 'v345-role-tag'));
          if (account.role) tags.append(el('span', plans[account.plan]||'Conta', 'v345-plan-tag'));
          tags.append(el('span', account.blocked ? 'Bloqueada' : 'Ativa', 'v345-state-tag'));
          const date=v=>v?.toDate?.().toLocaleString('pt-BR')||'—';
          info.append(identity, tags, el('small','Cadastro: '+date(account.createdAt)+' | Último acesso: '+date(account.lastAccess)), details);
          row.append(info);
          row.append(account.protected || account.uid === uid
            ? el('small', 'Conta protegida', 'v345-protected') : button('Editar acesso', () => edit(account, status, epoch)));
          rows.append(row);
        }
        if (!rows.childElementCount) rows.append(el('p', 'Nenhuma conta encontrada.'));
      };
      search.oninput = plan.onchange = state.onchange = render;
      render();
      rows.className = 'v345-admin-rows';
      const auditPanel = el('section', '', 'v345-audit');
      auditPanel.append(el('h3', 'Auditoria · últimos 100 registros'));
      host.append(stats, tools, rows, auditPanel);
      const labels = new Map(accounts.map(a => [a.uid, accountLabel(a)]));
      for (const event of audit) {
        const item = el('details');
        item.append(el('summary', (labels.get(event.target) || 'Conta') + ' · ' + event.beforePlan + ' → ' +
          event.afterPlan + ' · ' + (event.afterBlocked ? 'Bloqueada' : 'Ativa')),
          el('small', 'Operador ' + (labels.get(event.actor)||'Conta não identificada') + ' · ' + (event.at?.toDate?.().toLocaleString('pt-BR')||'—')));
        auditPanel.append(item);
      }
      if (!audit.length) auditPanel.append(el('p', 'Nenhuma alteração registrada.', 'v345-audit-empty'));
    } catch {
      if (epoch === serial) status.textContent = 'Acesso administrativo não autorizado ou conexão indisponível.';
    }
  }

  open.hidden = false;
  const launch = () => { const profile = open.closest('details'); if (profile) profile.open = false; void load(); };
  open.addEventListener('click', launch);
  return () => {
    alive=false;
    close();
    open.hidden = true;
    open.removeEventListener('click', launch);
  };
}
