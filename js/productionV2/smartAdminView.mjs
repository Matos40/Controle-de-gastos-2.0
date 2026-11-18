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
  let filters = {search:'',plan:'',state:'',admins:false};
  const close = () => {
    serial++;
    host.querySelectorAll('dialog[open]').forEach(d=>d.close());
    host.hidden = true;
    host.replaceChildren();
    const profile = open.closest('details');
    if (profile) profile.querySelector('summary')?.focus();
    else open.focus();
  };

  function edit(account, status, epoch) {
    const dialog = el('dialog', '', 'v345-dialog');
    const title = el('h2', accountLabel(account));
    title.id = 'v345EditTitle';
    dialog.setAttribute('aria-labelledby', title.id);
    const locked = account.protected || account.uid === uid || ['owner','admin'].includes(account.role);
    const details = el('dl','','v3467-details');
    const date=v=>v?.toDate?.().toLocaleString('pt-BR')||'—';
    for(const [label,value] of [['E-mail',account.email||'—'],['UID',account.uid],['Função',plans[account.role]||'Usuário'],['Plano',plans[account.plan]||'—'],['Situação',account.blocked?'Bloqueada':'Ativa'],['Cadastro',date(account.createdAt)],['Último acesso',date(account.lastAccess)]]){details.append(el('dt',label),el('dd',value));}
    const usage=el('section','','v3467-ai');usage.append(el('h3','Smart AI Usage'),el('p','Consumo e cotas ainda não disponíveis. Integração prevista na V34.7.'));
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
      if (locked || save.disabled || !alive || epoch!==serial) return;
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
    dialog.append(title, details, usage);
    if(locked) dialog.append(el('p','Conta protegida','v345-protected'),button('Fechar',()=>dialog.close()));
    else {const pl=el('label','Plano');pl.append(plan);const st=el('label','Situação');st.append(blocked);form.replaceChildren(pl,st,message,cancel,save);dialog.append(form);}
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
        const card = el('button', '', 'admin-stat');
        card.type='button';card.dataset.filter=label;card.setAttribute('aria-pressed','false');
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
      const roleFilter=selector('Função',[['','Todas as funções'],['admins','Administradores']]);
      tools.append(search, plan, state, roleFilter);
      search.value=filters.search;plan.value=filters.plan;state.value=filters.state;roleFilter.value=filters.admins?'admins':'';
      const monitor=el('details','','v3467-ai v3467-monitor');monitor.append(el('summary','Smart AI Monitor'),el('p','Contadores reais, cotas e custos indisponíveis até a integração segura da V34.7.'));
      const rows = el('div');
      const render = () => {
        rows.replaceChildren();
        filters={search:search.value,plan:plan.value,state:state.value,admins:roleFilter.value==='admins'};
        const active=filters.admins&&!filters.plan&&!filters.state?'Administradores':!filters.admins&&filters.plan&&!filters.state?plans[filters.plan]:!filters.admins&&!filters.plan&&filters.state?(filters.state==='active'?'Ativas':'Bloqueadas'):!filters.admins&&!filters.plan&&!filters.state&&!filters.search?'Usuários':'';
        for(const card of stats.children)card.setAttribute('aria-pressed',String(card.dataset.filter===active));
        for (const account of filterAccounts(accounts, search.value, plan.value, state.value).filter(a=>!filters.admins||['owner','admin'].includes(a.role))) {
          const row = el('article', '', 'admin-row');
          row.dataset.plan = account.role || account.plan;
          
          const identity = el('div', '', 'v345-admin-identity');
          const initials = accountLabel(account).trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
          const avatar = el('span', initials, 'v345-admin-avatar');
          avatar.setAttribute('aria-hidden', 'true');
          const name = el('div', '', 'v345-admin-name');
          name.append(el('strong', accountLabel(account)));name.title=accountLabel(account);
          if(account.photo){try{const url=new URL(account.photo);if(url.protocol==='https:'&&/(^|\.)googleusercontent\.com$/.test(url.hostname)&&!url.username&&!url.password){const img=el('img');img.alt='';img.referrerPolicy='no-referrer';img.loading='lazy';img.onload=()=>avatar.replaceChildren(img);img.src=url.href;}}catch{}}
          identity.append(avatar, name);
          const email=el('span',account.email||'—','v3467-email');email.title=account.email||'';
          const planTag=el('span',plans[account.plan]||'—','v3467-plan');planTag.dataset.value=account.plan;
          const stateTag=el('span',account.blocked?'Bloqueada':'Ativa','v3467-state');stateTag.dataset.blocked=String(account.blocked);
          const usage=el('span','—','v3467-usage');usage.title='Consumo de IA indisponível';
          const detailButton=button('Exibir detalhes',()=>edit(account,status,epoch));detailButton.setAttribute('aria-label','Exibir detalhes de '+accountLabel(account));
          row.append(identity,email,planTag,stateTag,usage,detailButton);
          rows.append(row);
        }
        if (!rows.childElementCount) rows.append(el('p', 'Nenhuma conta encontrada.'));
      };
      search.oninput = plan.onchange = state.onchange = roleFilter.onchange = render;
      for(const card of stats.children)card.onclick=()=>{search.value='';plan.value='';state.value='';roleFilter.value='';switch(card.dataset.filter){case 'Ativas':state.value='active';break;case 'Bloqueadas':state.value='blocked';break;case 'Administradores':roleFilter.value='admins';break;case 'Free':plan.value='free';break;case 'Premium':plan.value='premium';break;}render();};
      render();
      rows.className = 'v345-admin-rows';
      const auditPanel = el('section', '', 'v345-audit');
      auditPanel.append(el('h3', 'Auditoria · últimos 100 registros'));
      const columns=el('div','','v3467-columns');for(const label of ['Usuário','E-mail','Plano','Situação','Uso IA','Ação'])columns.append(el('span',label));
      host.append(stats, tools, monitor, columns, rows, auditPanel);
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
