/* AURA · Estado de acceso, sin contraseñas ni tokens en el frontend. */
(() => {
  const status=document.getElementById('auth-status');
  const signin=document.getElementById('auth-signin');
  const enter=document.getElementById('auth-enter');
  const signout=document.getElementById('auth-signout');
  const help=document.getElementById('auth-help');
  const mode=document.body.dataset.authMode||'login';
  if (!status||!signin||!enter||!signout||!help) return;

  const loginTarget=new URL('/login/',location.origin).href;
  signin.href='/.auth/login/github?post_login_redirect_uri='+encodeURIComponent(loginTarget);
  signout.href='/.auth/logout?post_logout_redirect_uri='+encodeURIComponent(loginTarget);
  const toggle=(state)=>{
    signin.hidden=!state.signin;
    enter.hidden=!state.enter;
    signout.hidden=!state.signout;
    help.hidden=!state.help;
    status.classList.toggle('auth-status-ok',!!state.ok);
    status.classList.toggle('auth-status-warning',!!state.warning);
  };
  const show=(text,state)=>{
    status.textContent=text;
    toggle(state);
  };

  (async()=>{
    try {
      const response=await fetch('/.auth/me',{credentials:'same-origin',cache:'no-store'});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const json=await response.json();
      const principal=json&&json.clientPrincipal;
      if(!principal) {
        show('Todavía no has iniciado sesión. Ingresa con la cuenta GitHub que administra AURA.',{signin:true,enter:false,signout:false,help:mode==='forbidden'});
        return;
      }
      const name=typeof principal.userDetails==='string'?principal.userDetails:'usuario autenticado';
      const roles=Array.isArray(principal.userRoles)?principal.userRoles:[];
      if(roles.includes('administrator')) {
        const text=mode==='forbidden'
          ?'Sesión de '+name+' con rol administrator. Si Azure sigue bloqueando el panel, cierra sesión y vuelve a ingresar; verifica también el dominio que usaste en la invitación.'
          :'¡Acceso autorizado! Sesión de '+name+'. Puedes entrar al administrador de AURA.';
        show(text,{signin:false,enter:true,signout:true,help:mode==='forbidden',ok:mode!=='forbidden'});
      } else {
        show('Sesión iniciada como '+name+'. Falta el permiso administrator de Azure para acceder a publicaciones y mensajes privados.',{signin:false,enter:false,signout:true,help:true,warning:true});
      }
    }catch {
      show('No se pudo comprobar la sesión en Azure. Puedes iniciar sesión otra vez o reintentar más tarde.',{signin:true,enter:false,signout:true,help:true,warning:true});
    }
  })();
})();