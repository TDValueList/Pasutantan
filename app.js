(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const app = $('#app');
  const cfg = window.PASUCHAT_CONFIG || {};
  const configured = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase?.createClient);
  const db = configured ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
  const AVATARS = ['🌱','🌙','⭐','🐱','🐼','🦊','🐸','🐧','🍮','🍀','🎮','🌈'];
  const DEMO_USER = { id:'demo-user', username:'pasu_demo', display_name:'Pasu', avatar_id:'🎮', bio:'PasuChatへようこそ！' };
  const demoPosts = [
    { id:'p1', user_id:'u1', display_name:'Minto', username:'minto_7', avatar_id:'🐱', content:'PasuChatのテスト中！ここでいろんな人と話せるようになるの楽しみ。', visibility:'public', created_at:new Date(Date.now()-1000*60*8).toISOString(), likes:5, liked:false, comments:[{name:'Pasu',content:'よろしく！'}] },
    { id:'p2', user_id:'u2', display_name:'Kota', username:'kota22', avatar_id:'🌙', content:'今日もよろしくお願いします！おすすめのゲームがあったら教えてください。', visibility:'public', created_at:new Date(Date.now()-1000*60*42).toISOString(), likes:2, liked:false, comments:[] },
    { id:'p3', user_id:'u3', display_name:'Aoi', username:'aoi_blue', avatar_id:'🦊', content:'新しいプロフィールアイコンを選んでみた。', visibility:'public', created_at:new Date(Date.now()-1000*60*60*3).toISOString(), likes:8, liked:true, comments:[] }
  ];
  const state = { user:null, profile:null, page:'feed', demo:false, posts:[], openComments:null, notifications:[], activeChat:null, activeChatUser:null, dmThreads:[], dmMessages:[], dmChannel:null, demoDMStore:{}, groups:[], activeGroupId:null, groupMessages:[], groupChannel:null, groupInvites:[], notificationsChannel:null, friendRequestsChannel:null, friendRequests:[], friends:[], searchResults:[], unread:0, onlineTimer:null, authListenerRegistered:false };

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const avatar = (value, size='') => `<div class="avatar ${size}">${esc(value || '🌱')}</div>`;
  const shortDate = value => {
    const d = new Date(value); const diff = Date.now() - d.getTime();
    if (diff < 60000) return 'たった今';
    if (diff < 3600000) return `${Math.floor(diff/60000)}分前`;
    if (diff < 86400000) return `${Math.floor(diff/3600000)}時間前`;
    return `${d.getMonth()+1}/${d.getDate()}`;
  };
  const visibilityLabel = v => ({public:'全体公開',friends:'フレンドのみ',private:'自分のみ'}[v] || '全体公開');
  const isOnline = value => Boolean(value && Date.now() - new Date(value).getTime() < 3 * 60 * 1000);
  const showToast = message => {
    $('.toast')?.remove(); const node = document.createElement('div'); node.className='toast'; node.textContent=message; document.body.append(node); setTimeout(()=>node.remove(),2600);
  };

  function renderAuth(mode='login') {
    const signup = mode === 'signup';
    app.innerHTML = `<main class="auth-wrap"><section class="auth-card">
      <div class="auth-brand"><div class="brand-mark">P</div><div><div class="brand-name">Pasutantan</div><div class="auth-sub">CONNECT · CHAT · SHARE</div></div></div>
      <h1>${signup?'アカウントを作成':'おかえりなさい'}</h1>
      <p class="intro">${signup?'ユーザー名とパスワードを設定して、Pasutantanを始めよう。':'ログインして、みんなとの会話を続けよう。'}</p>
      <form id="auth-form">
        <div class="field"><label for="username">ユーザー名</label><input id="username" name="username" maxlength="20" minlength="3" autocomplete="username" placeholder="例：pasu_123" required pattern="[A-Za-z0-9_]{3,20}"><small>3〜20文字。半角英数字と _ が使えます。</small></div>
        ${signup?'<div class="field"><label for="display-name">表示名</label><input id="display-name" name="displayName" maxlength="24" placeholder="ほかの人に表示する名前" required></div>':''}
        <div class="field"><label for="password">パスワード</label><input id="password" name="password" type="password" minlength="8" autocomplete="${signup?'new-password':'current-password'}" placeholder="8文字以上" required></div>
        <button class="btn block" type="submit">${signup?'アカウントを作成':'ログイン'}</button><p class="status-msg" id="auth-status"></p>
      </form>
      <div class="auth-actions">${signup?'すでにアカウントを持っている？':'アカウントを持っていない？'} <button class="text-btn" id="switch-auth">${signup?'ログイン':'新規登録'}</button></div>
      ${configured?'<div class="auth-note">パスワードを忘れた場合は管理者に連絡してください。管理者による再設定機能は接続後の工程で追加します。</div>':'<div class="auth-note">現在はプレビュー状態です。Supabaseを接続するまでは、実際のアカウント登録・オンライン保存は利用できません。</div>'}
      <button class="btn secondary block" id="demo-enter" style="margin-top:18px">デモ画面を見る</button>
    </section></main>`;
    $('#switch-auth').addEventListener('click',()=>renderAuth(signup?'login':'signup'));
    $('#demo-enter').addEventListener('click',enterDemo);
    $('#auth-form').addEventListener('submit',e=>handleAuth(e,signup));
  }

  function syntheticEmail(username) { return `${username.toLowerCase()}@accounts.pasuchat.invalid`; }
  async function handleAuth(event, signup) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const username = String(form.get('username')||'').trim().toLowerCase();
    const password = String(form.get('password')||''); const status = $('#auth-status');
    status.textContent = configured ? '処理中...' : 'Supabaseを接続すると利用できます。下の「デモ画面を見る」を使ってください。';
    if (!configured) return;
    try {
      if (signup) {
        const displayName = String(form.get('displayName')||'').trim();
        // Create username-only accounts in a server-side Edge Function. The function
        // creates the synthetic-email Auth user as already confirmed, so the project-wide
        // email-confirmation setting does not need to be weakened.
        const { error: signupError } = await db.functions.invoke('username-signup', {
          body: { username, displayName, password }
        });
        if (signupError) throw signupError;
        const { error: loginError } = await db.auth.signInWithPassword({ email:syntheticEmail(username), password });
        if (loginError) {
          status.textContent = 'アカウントは作成できました。ログイン画面からログインしてください。';
          return;
        }
        await loadSession();
        showToast('アカウントを作成しました');
      } else {
        const { error } = await db.auth.signInWithPassword({ email:syntheticEmail(username), password });
        if (error) throw error;
        await loadSession();
      }
    } catch (error) { status.textContent = friendlyError(error); }
  }
  function friendlyError(error) {
    const msg = String(error?.message || '不明なエラー');
    if (/invalid login credentials/i.test(msg)) return 'ユーザー名またはパスワードが違います。';
    if (/already registered|user already exists/i.test(msg)) return 'このユーザー名はすでに使われています。';
    if (/password should be at least/i.test(msg)) return 'パスワードは8文字以上にしてください。';
    return msg;
  }

  function enterDemo() {
    state.demo=true; state.user=DEMO_USER; state.profile=DEMO_USER; state.posts=JSON.parse(JSON.stringify(demoPosts));
    state.notifications=[{id:'n1',notification_type:'friend_request',target_id:'demo-request-1',text:'Mintoさんからフレンド申請が届きました。',created_at:new Date(Date.now()-600000).toISOString(),is_read:false},{id:'n2',notification_type:'dm',target_id:'demo-thread-kota',text:'Kotaさんからメッセージが届きました。',created_at:new Date(Date.now()-3600000).toISOString(),is_read:true},{id:'n3',notification_type:'group_message',target_id:'demo-group-1',text:'Kotaさんが「ゲーム雑談」にメッセージを送信しました。',created_at:new Date(Date.now()-7200000).toISOString(),is_read:true}];
    state.dmThreads=[{id:'demo-thread-minto',other:{id:'u1',username:'minto_7',display_name:'Minto',avatar_id:'🐱'},lastMessage:'PasuChatのテスト中！',created_at:new Date().toISOString()},{id:'demo-thread-kota',other:{id:'u2',username:'kota22',display_name:'Kota',avatar_id:'🌙'},lastMessage:'こんにちは！',created_at:new Date(Date.now()-3600000).toISOString()}];
    state.demoDMStore={'demo-thread-minto':[{id:'demo-m1',thread_id:'demo-thread-minto',sender_id:'u1',content:'PasuChatのテスト中！',created_at:new Date(Date.now()-420000).toISOString()},{id:'demo-m2',thread_id:'demo-thread-minto',sender_id:'demo-user',content:'いいね！一緒に使いやすくしていこう。',created_at:new Date(Date.now()-380000).toISOString()}],'demo-thread-kota':[{id:'demo-k1',thread_id:'demo-thread-kota',sender_id:'u2',content:'こんにちは！',created_at:new Date(Date.now()-3600000).toISOString()}]};
    state.activeChat=null; state.dmMessages=[]; state.groups=[{id:'demo-group-1',name:'ゲーム雑談',owner_id:'demo-user',created_at:new Date().toISOString()}]; state.activeGroupId=null; state.groupMessages=[{id:'demo-g1',group_id:'demo-group-1',sender_id:'u2',sender_name:'Kota',content:'このグループでゲームの話をしよう！',created_at:new Date(Date.now()-1800000).toISOString()}]; state.demoGroupStore={'demo-group-1':state.groupMessages}; state.groupInvites=[{id:'demo-invite-1',group_id:'demo-group-2',group_name:'テストグループ',inviter_name:'Minto'}]; state.friendRequests=[{id:'demo-request-1',from_user:'u1',profile:{id:'u1',username:'minto_7',display_name:'Minto',avatar_id:'🐱'}}]; state.friends=[{id:'u2',username:'kota22',display_name:'Kota',avatar_id:'🌙'}];
    renderApp();
  }
  async function loadSession() {
    if (!db) return;
    const { data:{ user } } = await db.auth.getUser();
    if (!user) { renderAuth(); return; }
    const { data:profile, error } = await db.from('profiles').select('*').eq('id',user.id).maybeSingle();
    if (error) { showToast('プロフィールを読み込めませんでした'); console.error(error); return; }
    state.user=user; state.profile=profile; state.demo=false;
    await Promise.all([loadPosts(), loadNotifications()]); renderApp(); touchOnline(); subscribeNotifications(); subscribeFriendRequests();
    if(!state.authListenerRegistered){
      db.auth.onAuthStateChange((_event,session)=>{
        if(!session){
          if(state.onlineTimer){clearInterval(state.onlineTimer);state.onlineTimer=null;}
          for(const channel of [state.dmChannel,state.groupChannel,state.notificationsChannel,state.friendRequestsChannel])if(channel)db.removeChannel(channel);
          state.dmChannel=state.groupChannel=state.notificationsChannel=state.friendRequestsChannel=null;
          state.user=null;state.profile=null;renderAuth();
        }
      });
      state.authListenerRegistered=true;
    }
    if(state.onlineTimer)clearInterval(state.onlineTimer);
    state.onlineTimer=setInterval(touchOnline,60000);
  }
  async function touchOnline() {
    if (!db || !state.user || state.demo) return;
    await db.from('profiles').update({last_seen_at:new Date().toISOString()}).eq('id',state.user.id);
  }

  function navButton(page, icon, label, count='') { return `<button class="nav-btn ${state.page===page?'active':''}" data-page="${page}"><span class="nav-icon">${icon}</span><span>${label}</span>${count?`<span class="nav-count">${count}</span>`:''}</button>`; }
  function renderApp() {
    const name=state.profile?.display_name || state.profile?.username || 'Pasu';
    const handle=state.profile?.username || 'pasu_demo';
    const av=state.profile?.avatar_id || '🌱';
    const onlineFriends=state.demo?[{name:'Minto',av:'🐱',handle:'minto_7'}]:state.friends.filter(u=>isOnline(u.last_seen_at)).map(u=>({name:u.display_name||u.username,av:u.avatar_id,handle:u.username}));
    app.innerHTML=`<div class="app-shell">
      <aside class="sidebar"><div class="sidebar-brand"><div class="brand-mark">P</div><div class="brand-name">Pasutantan</div></div>
        <div class="nav-label">MENU</div><nav class="nav-list">${navButton('feed','⌂','タイムライン')}${navButton('chats','▤','チャット')}${navButton('friends','♙','フレンド')}${navButton('notifications','♢','通知',state.notifications.filter(n=>!n.is_read).length||'')}${navButton('profile','◉','プロフィール')}</nav>
        <div class="sidebar-bottom"><div class="nav-label">ACCOUNT</div><button class="nav-btn" id="logout"><span class="nav-icon">↪</span><span>ログアウト</span></button><div class="user-mini">${avatar(av,'small')}<div class="user-mini-info"><div class="user-mini-name">${esc(name)}</div><div class="user-mini-handle">@${esc(handle)}</div></div><span class="online-dot"></span></div></div>
      </aside>
      <main class="main-column"><header class="topbar"><h1>${({feed:'タイムライン',chats:'チャット',friends:'フレンド',notifications:'通知',profile:'プロフィール'})[state.page]}</h1><div class="topbar-right">${state.demo?'<span class="demo-tag">DEMO MODE</span>':''}<button class="icon-btn" id="top-notifications" title="通知">♢${state.notifications.some(n=>!n.is_read)?'<i class="notification-dot"></i>':''}</button></div></header><div class="content" id="page-content">${pageMarkup()}</div></main>
      <aside class="rightbar"><section class="right-panel"><h3>オンライン</h3>${onlineFriends.map(u=>`<div class="online-row">${avatar(u.av,'small')}<div class="user-detail"><strong>${esc(u.name)}</strong><small>@${esc(u.handle)}</small></div><i class="online-dot"></i></div>`).join('') || '<p>オンラインのフレンドはここに表示されます。</p>'}</section><section class="right-panel"><h3>Pasutantanについて</h3><p>文字でつながる、小さなコミュニティ。タイムラインもチャットも、気軽に楽しもう。</p></section><section class="right-panel"><h3>現在の仕様</h3><p>画像投稿・画像送信はできません。投稿の公開範囲は、全体公開・フレンドのみ・自分のみから選べます。</p></section></aside>
      <nav class="mobile-nav">${navButton('feed','⌂','ホーム')}${navButton('chats','▤','チャット')}${navButton('friends','♙','フレンド')}${navButton('notifications','♢','通知')}${navButton('profile','◉','プロフィール')}</nav>
    </div>`;
    app.querySelectorAll('[data-page]').forEach(button=>button.addEventListener('click',()=>{ state.page=button.dataset.page; renderApp(); afterPageRender(); }));
    $('#logout').addEventListener('click',logout);
    $('#top-notifications').addEventListener('click',()=>{state.page='notifications';renderApp();afterPageRender();});
    bindPage();
  }

  function afterPageRender() {
    if (state.page === 'feed') loadPosts();
    if (state.page === 'chats') { loadDMThreads(); loadGroupRooms(); loadGroupInvites(); if(!state.demo) loadFriendsData(); }
    if (state.page === 'friends') loadFriendsData();
    if (state.page === 'notifications') loadNotifications();
  }

  function pageMarkup() {
    if (state.page==='feed') return feedMarkup();
    if (state.page==='chats') return chatsMarkup();
    if (state.page==='friends') return friendsMarkup();
    if (state.page==='notifications') return notificationsMarkup();
    return profileMarkup();
  }
  function feedMarkup() {
    const posts=state.posts;
    return `<div class="page-heading"><h2>みんなの投稿</h2><p>最近の出来事や、ちょっとしたことを共有しよう。</p></div>
      <section class="composer"><div class="composer-top">${avatar(state.profile?.avatar_id,'')}<textarea id="post-content" maxlength="500" placeholder="今なにしてる？"></textarea></div><div class="composer-foot"><small>テキストのみ · 最大500文字</small><div class="composer-tools"><select class="select-small" id="post-visibility"><option value="public">全体公開</option><option value="friends">フレンドのみ</option><option value="private">自分のみ</option></select><button class="btn small" id="publish-post">投稿する</button></div></div></section>
      <div class="feed-list">${posts.length?posts.map(postMarkup).join(''):'<div class="empty-card"><div class="empty-icon">✎</div><strong>まだ投稿がありません</strong><p>最初の投稿をして、Pasutantanを始めよう。</p></div>'}</div>`;
  }
  function postMarkup(post) {
    const own=post.user_id===state.user.id;
    return `<article class="post-card" data-post="${esc(post.id)}"><div class="post-head">${avatar(post.avatar_id||'🌱','small')}<div class="post-author"><div class="post-name">${esc(post.display_name||post.username||'ユーザー')}</div><div class="post-meta">@${esc(post.username||'user')} · ${shortDate(post.created_at)}</div></div><span class="post-visibility">${visibilityLabel(post.visibility)}</span></div><div class="post-body">${esc(post.content)}</div><div class="post-actions"><button class="action-btn ${post.liked?'liked':''}" data-like="${esc(post.id)}">${post.liked?'♥':'♡'} ${post.likes||0} いいね</button><button class="action-btn" data-comments="${esc(post.id)}">▱ ${post.comments?.length||post.comment_count||0} コメント</button>${own?`<button class="action-btn" data-delete-post="${esc(post.id)}">削除</button>`:''}</div>${state.openComments===post.id?`<div class="comment-area"><div class="comment-list">${(post.comments||[]).map(c=>`<div class="comment"><strong>${esc(c.name||c.display_name||'ユーザー')}</strong>${esc(c.content)}</div>`).join('')||'<div class="comment">まだコメントはありません。</div>'}</div><form class="comment-form" data-comment-form="${esc(post.id)}"><input name="comment" maxlength="300" placeholder="コメントを書く..." required><button class="btn small">送信</button></form></div>`:''}</article>`;
  }
  async function loadPosts() {
    if (state.demo || !db || !state.user) { if(state.demo) renderApp(); return; }
    const {data:posts,error}=await db.from('posts').select('id,user_id,content,visibility,created_at').order('created_at',{ascending:false}).limit(40);
    if(error){console.error('PasuChat posts:',error);showToast('投稿を読み込めませんでした: '+friendlyError(error));return;}
    const ids=[...new Set((posts||[]).map(p=>p.user_id))];
    const {data:profiles,error:profileError}=ids.length?await db.from('profiles').select('id,username,display_name,avatar_id').in('id',ids):{data:[],error:null};
    if(profileError)console.warn('PasuChat post profiles:',profileError);
    const prof=new Map((profiles||[]).map(p=>[p.id,p]));
    const postIds=(posts||[]).map(p=>p.id);
    const [likesResult,mineResult,commentsResult]=await Promise.all([
      postIds.length?db.from('post_likes').select('post_id').in('post_id',postIds):Promise.resolve({data:[],error:null}),
      postIds.length?db.from('post_likes').select('post_id').eq('user_id',state.user.id).in('post_id',postIds):Promise.resolve({data:[],error:null}),
      postIds.length?db.from('post_comments').select('post_id').in('post_id',postIds):Promise.resolve({data:[],error:null})
    ]);
    for (const result of [likesResult,mineResult,commentsResult]) if(result.error) console.error('PasuChat post reactions:',result.error);
    const likes=likesResult.data||[],mine=mineResult.data||[],comments=commentsResult.data||[];
    const likeCounts={},commentCounts={};
    likes.forEach(x=>likeCounts[x.post_id]=(likeCounts[x.post_id]||0)+1);
    comments.forEach(x=>commentCounts[x.post_id]=(commentCounts[x.post_id]||0)+1);
    const liked=new Set(mine.map(x=>x.post_id));
    state.posts=(posts||[]).map(p=>({...p,...(prof.get(p.user_id)||{}),likes:likeCounts[p.id]||0,liked:liked.has(p.id),comment_count:commentCounts[p.id]||0,comments:[]}));
    if(state.page==='feed') { const content=$('#page-content'); if(content) content.innerHTML=feedMarkup(); bindPage(); }
  }
  async function publishPost() {
    const content=$('#post-content')?.value.trim(); const visibility=$('#post-visibility')?.value||'public';
    if(!content) return showToast('投稿内容を入力してください');
    if(state.demo){ state.posts.unshift({id:`p${Date.now()}`,user_id:state.user.id,username:state.profile.username,display_name:state.profile.display_name,avatar_id:state.profile.avatar_id,content,visibility,created_at:new Date().toISOString(),likes:0,liked:false,comments:[]}); renderApp(); return showToast('投稿しました（デモ）'); }
    const {error}=await db.from('posts').insert({user_id:state.user.id,content,visibility});
    if(error) return showToast('投稿できませんでした: '+friendlyError(error));
    await loadPosts(); showToast('投稿しました');
  }
  async function toggleLike(postId) {
    const post=state.posts.find(p=>p.id===postId); if(!post)return;
    if(state.demo){post.liked=!post.liked;post.likes=Math.max(0,post.likes+(post.liked?1:-1));renderApp();return;}
    const query=post.liked
      ? db.from('post_likes').delete().eq('post_id',postId).eq('user_id',state.user.id)
      : db.from('post_likes').insert({post_id:postId,user_id:state.user.id});
    const {error}=await query;
    if(error){console.error('PasuChat like:',error);return showToast('いいねを更新できませんでした: '+friendlyError(error));}
    await loadPosts();
  }
  async function deletePost(postId) {
    if(!confirm('この投稿を削除しますか？'))return;
    if(state.demo){state.posts=state.posts.filter(p=>p.id!==postId);renderApp();return showToast('削除しました（デモ）');}
    const {error}=await db.from('posts').delete().eq('id',postId).eq('user_id',state.user.id);
    if(error)return showToast('削除できませんでした'); await loadPosts();
  }
  async function fetchPostComments(postId) {
    const post=state.posts.find(p=>p.id===postId); if(!post)return false;
    const {data,error}=await db.from('post_comments').select('id,user_id,content,created_at').eq('post_id',postId).order('created_at',{ascending:true});
    if(error){console.error('PasuChat comments:',error);showToast('コメントを読み込めませんでした: '+friendlyError(error));return false;}
    const ids=[...new Set((data||[]).map(x=>x.user_id))];
    const {data:profiles,error:profileError}=ids.length?await db.from('profiles').select('id,display_name,username').in('id',ids):{data:[],error:null};
    if(profileError)console.warn('PasuChat comment profiles:',profileError);
    const map=new Map((profiles||[]).map(p=>[p.id,p]));
    post.comments=(data||[]).map(c=>({...c,...map.get(c.user_id),name:map.get(c.user_id)?.display_name||map.get(c.user_id)?.username||'ユーザー'}));
    post.comment_count=post.comments.length;
    return true;
  }
  async function loadComments(postId) {
    const post=state.posts.find(p=>p.id===postId); if(!post)return;
    if(state.demo){state.openComments=state.openComments===postId?null:postId;renderApp();return;}
    if(state.openComments===postId){state.openComments=null;renderApp();return;}
    state.openComments=postId;
    if(!await fetchPostComments(postId)){state.openComments=null;return;}
    renderApp();
  }
  async function addComment(event,postId) {
    event.preventDefault();
    const form=event.currentTarget;
    const text=String(new FormData(form).get('comment')||'').trim();
    if(!text)return;
    const post=state.posts.find(p=>p.id===postId); if(!post)return;
    if(state.demo){post.comments.push({name:state.profile.display_name,content:text});post.comment_count=post.comments.length;state.openComments=postId;renderApp();return;}
    const {error}=await db.from('post_comments').insert({post_id:postId,user_id:state.user.id,content:text});
    if(error){console.error('PasuChat add comment:',error);return showToast('コメントできませんでした: '+friendlyError(error));}
    form.reset();
    state.openComments=postId;
    if(await fetchPostComments(postId))renderApp();
  }

  function chatsMarkup(){
    const selected = state.dmThreads.find(t=>t.id===state.activeChat);
    const selectedGroup = state.groups.find(g=>g.id===state.activeGroupId);
    return `<div class="page-heading"><h2>メッセージ</h2><p>フレンド以外のユーザーにもDMを送れます。メッセージは文字のみです。</p></div>
      <section class="chat-layout"><div class="chat-list">
        <form id="dm-search-form" class="dm-search-form"><input class="search-input" id="dm-user-search" placeholder="ユーザー名でDMを開始..." autocomplete="off"><button class="btn small" type="submit">検索</button></form>
        <div id="dm-search-results"></div><h3>ダイレクトメッセージ</h3>
        <div id="dm-thread-list">${dmThreadListMarkup()}</div>
        <div class="group-list-heading"><h3>グループチャット</h3><button class="text-btn" id="create-group" type="button">＋ 作成</button></div>
        <div id="group-list">${groupListMarkup()}</div>
        <div class="group-invites-heading"><h3>グループ招待</h3></div><div id="group-invite-list">${groupInviteListMarkup()}</div>
      </div><div class="chat-window" id="chat-window">${selectedGroup?groupChatWindowMarkup(selectedGroup):selected?chatWindowMarkup(selected):'<div class="chat-placeholder"><div class="empty-icon">▤</div><strong>会話を始めよう</strong><p>左側で会話を選ぶか、ユーザー名を検索してDMを開始できます。</p><button class="btn small" id="go-friends">フレンドを見る</button></div>'}</div></section>`;
  }
  function groupListMarkup(){
    if(!state.groups.length)return '<div class="chat-list-empty">グループはまだありません。</div>';
    return state.groups.map(g=>`<button class="dm-thread ${state.activeGroupId===g.id?'active':''}" data-open-group="${esc(g.id)}"><span class="group-avatar">#</span><span class="dm-thread-info"><strong>${esc(g.name)}</strong><small>グループチャット</small></span></button>`).join('');
  }
  function groupInviteListMarkup(){
    if(!state.groupInvites.length)return '<div class="chat-list-empty">招待はありません。</div>';
    return state.groupInvites.map(i=>`<div class="group-invite-card"><div><strong>${esc(i.group_name||'グループへの招待')}</strong><small>${esc(i.inviter_name||'ユーザー')}さんから</small></div><div class="group-invite-actions"><button class="btn small" data-accept-group-invite="${esc(i.id)}">参加</button><button class="btn secondary small" data-reject-group-invite="${esc(i.id)}">拒否</button></div></div>`).join('');
  }
  function groupChatWindowMarkup(group){
    const friendOptions=state.friends.map(f=>`<option value="${esc(f.id)}">${esc(f.display_name||f.username)} (@${esc(f.username)})</option>`).join('');
    return `<div class="chat-window-head"><span class="group-avatar">#</span><span><strong>${esc(group.name)}</strong><small>グループチャット</small></span></div>
      <div class="group-invite-bar"><form id="group-invite-form"><select name="friendId" class="select-small" ${state.friends.length?'':'disabled'}><option value="">招待するフレンドを選択</option>${friendOptions}</select><button class="btn secondary small" type="submit" ${state.friends.length?'':'disabled'}>招待</button></form></div>
      <div class="chat-messages" id="group-messages">${state.groupMessages.length?state.groupMessages.map(groupMessageMarkup).join(''):'<div class="chat-empty">まだメッセージはありません。最初のメッセージを送ってみよう！</div>'}</div>
      <form class="chat-compose" id="group-compose-form"><input class="chat-input" name="message" maxlength="2000" placeholder="グループにメッセージ..." autocomplete="off" required><button class="btn" type="submit">送信</button></form>`;
  }
  function groupMessageMarkup(m){
    const mine=m.sender_id===state.user?.id||(state.demo&&m.sender_id==='demo-user');
    const body=m.is_deleted?'このメッセージは削除されました。':esc(m.content);
    return `<div class="chat-message-row ${mine?'mine':''}"><div class="chat-bubble ${mine?'mine':''}">${!mine?`<strong class="group-sender">${esc(m.sender_name||'ユーザー')}</strong>`:''}<div>${body}</div><small>${shortDate(m.created_at)}${m.edited_at&&!m.is_deleted?' · 編集済み':''}</small>${mine&&!m.is_deleted?`<div class="message-tools"><button type="button" data-edit-group-message="${esc(m.id)}">編集</button><button type="button" data-delete-group-message="${esc(m.id)}">削除</button></div>`:''}</div></div>`;
  }
  function dmThreadListMarkup(){
    if(!state.dmThreads.length) return '<div class="empty-card" style="padding:18px 9px;background:transparent;border:0"><p>まだ会話がありません。</p></div>';
    return state.dmThreads.map(t=>`<button class="dm-thread ${state.activeChat===t.id?'active':''}" data-open-dm="${esc(t.id)}">${avatar(t.other?.avatar_id,'small')}<span class="dm-thread-info"><strong>${esc(t.other?.display_name||t.other?.username||'ユーザー')}</strong><small>@${esc(t.other?.username||'user')}</small><small class="dm-last">${esc(t.lastMessage||'メッセージはまだありません')}</small></span></button>`).join('');
  }
  function chatWindowMarkup(thread){
    const other=thread.other||state.activeChatUser||{};
    return `<div class="chat-window-head">${avatar(other.avatar_id,'small')}<span><strong>${esc(other.display_name||other.username||'ユーザー')}</strong><small>@${esc(other.username||'user')}</small></span><i class="${isOnline(other.last_seen_at)?'online-dot':'online-dot muted-dot'}"></i></div>
      <div class="chat-messages" id="chat-messages">${state.dmMessages.length?state.dmMessages.map(dmMessageMarkup).join(''):'<div class="chat-empty">メッセージはまだありません。最初のメッセージを送ってみよう！</div>'}</div>
      <form class="chat-compose" id="chat-compose-form"><input class="chat-input" name="message" maxlength="2000" placeholder="メッセージを入力..." autocomplete="off" required><button class="btn" type="submit">送信</button></form>`;
  }
  function dmMessageMarkup(m){
    const mine=m.sender_id===state.user?.id || (state.demo && m.sender_id==='demo-user');
    const body=m.is_deleted?'このメッセージは削除されました。':esc(m.content);
    return `<div class="chat-message-row ${mine?'mine':''}"><div class="chat-bubble ${mine?'mine':''}"><div>${body}</div><small>${shortDate(m.created_at)}${m.edited_at&&!m.is_deleted?' · 編集済み':''}</small>${mine&&!m.is_deleted?`<div class="message-tools"><button type="button" data-edit-message="${esc(m.id)}">編集</button><button type="button" data-delete-message="${esc(m.id)}">削除</button></div>`:''}</div></div>`;
  }
  function friendsMarkup(){return `<div class="page-heading"><h2>フレンド</h2><p>ユーザー名で検索して、フレンドを見つけよう。</p></div><div class="search-row"><input class="search-input" id="user-search" placeholder="ユーザー名で検索..."><button class="btn small" id="search-users">検索</button></div><div class="result-list" id="friend-results"><div class="empty-card"><div class="empty-icon">♙</div><strong>ユーザーを検索</strong><p>ユーザー名を入力して検索できます。</p></div></div><div class="page-heading sub-heading"><h2>届いたフレンド申請</h2></div><div class="result-list" id="incoming-requests"><div class="empty-card">読み込み中...</div></div><div class="page-heading sub-heading"><h2>フレンド一覧</h2></div><div class="result-list" id="friends-list"><div class="empty-card">読み込み中...</div></div>`;}

  async function searchUsers(){
    const term=$('#user-search')?.value.trim().toLowerCase();
    if(!term)return showToast('ユーザー名を入力してください');
    const root=$('#friend-results');root.innerHTML='<div class="empty-card">検索中...</div>';
    if(state.demo){
      const users=[{id:'u1',username:'minto_7',display_name:'Minto',avatar_id:'🐱'},{id:'u2',username:'kota22',display_name:'Kota',avatar_id:'🌙'}].filter(u=>u.username.includes(term));
      root.innerHTML=users.length?users.map(u=>userResultMarkup(u)).join(''):'<div class="empty-card">ユーザーが見つかりませんでした。</div>';
      bindUserResults();return;
    }
    const {data,error}=await db.from('profiles').select('id,username,display_name,avatar_id').ilike('username',`%${term}%`).neq('id',state.user.id).limit(20);
    if(error){root.innerHTML='<div class="empty-card">検索できませんでした。</div>';return;}
    root.innerHTML=data?.length?data.map(userResultMarkup).join(''):'<div class="empty-card">ユーザーが見つかりませんでした。</div>';
    bindUserResults();
  }
  function userResultMarkup(u){return `<div class="list-card">${avatar(u.avatar_id,'small')}<div class="list-card-main"><strong>${esc(u.display_name||u.username)}</strong><small>@${esc(u.username)}</small></div><button class="btn secondary small" data-start-dm="${esc(u.id)}">DM</button><button class="btn small" data-friend-add="${esc(u.id)}">申請</button></div>`;}
  function bindUserResults(){
    const root=$('#friend-results');if(!root)return;
    root.querySelectorAll('[data-friend-add]').forEach(b=>b.addEventListener('click',()=>sendFriendRequest(b.dataset.friendAdd)));
    root.querySelectorAll('[data-start-dm]').forEach(b=>b.addEventListener('click',()=>startDMFromSearch(b.dataset.startDm)));
  }
  async function sendFriendRequest(id){
    if(state.demo){showToast('フレンド申請を送りました（デモ）');return;}
    const {error}=await db.from('friend_requests').insert({from_user:state.user.id,to_user:id});
    if(error){if(/duplicate|unique/i.test(error.message||''))return showToast('すでに申請済みです。');return showToast(friendlyError(error));}
    showToast('フレンド申請を送りました');
  }
  async function loadFriendsData(){
    if(state.demo){renderFriendLists();return;}
    if(!db||!state.user)return;
    const {data,error}=await db.from('friend_requests').select('id,from_user,to_user,status,created_at').or(`from_user.eq.${state.user.id},to_user.eq.${state.user.id}`).order('created_at',{ascending:false}).limit(100);
    if(error){console.error(error);return;}
    const ids=[...new Set((data||[]).flatMap(r=>[r.from_user,r.to_user]).filter(id=>id!==state.user.id))];
    const {data:profiles}=ids.length?await db.from('profiles').select('id,username,display_name,avatar_id,last_seen_at').in('id',ids):{data:[]};
    const map=new Map((profiles||[]).map(p=>[p.id,p]));
    state.friendRequests=(data||[]).filter(r=>r.status==='pending'&&r.to_user===state.user.id).map(r=>({...r,profile:map.get(r.from_user)}));
    state.friends=(data||[]).filter(r=>r.status==='accepted').map(r=>map.get(r.from_user===state.user.id?r.to_user:r.from_user)).filter(Boolean);
    renderFriendLists(); refreshGroupInvitePicker();
  }
  function refreshGroupInvitePicker(){const select=$('#group-invite-form select[name=friendId]');if(!select)return;const options=state.friends.map(f=>`<option value="${esc(f.id)}">${esc(f.display_name||f.username)} (@${esc(f.username)})</option>`).join('');select.innerHTML=`<option value="">招待するフレンドを選択</option>${options}`;select.disabled=!state.friends.length;const button=$('#group-invite-form button[type=submit]');if(button)button.disabled=!state.friends.length;}
  function renderFriendLists(){
    const incoming=$('#incoming-requests'),friends=$('#friends-list');
    if(incoming)incoming.innerHTML=state.friendRequests.length?state.friendRequests.map(r=>`<div class="list-card">${avatar(r.profile?.avatar_id,'small')}<div class="list-card-main"><strong>${esc(r.profile?.display_name||r.profile?.username||'ユーザー')}</strong><small>@${esc(r.profile?.username||'user')}</small></div><button class="btn small" data-accept-friend="${esc(r.id)}">承認</button><button class="btn secondary small" data-reject-friend="${esc(r.id)}">拒否</button></div>`).join(''):'<div class="empty-card">新しい申請はありません。</div>';
    if(friends)friends.innerHTML=state.friends.length?state.friends.map(u=>`<div class="list-card">${avatar(u.avatar_id,'small')}<div class="list-card-main"><strong>${esc(u.display_name||u.username)}</strong><small>@${esc(u.username)} · <span class="friend-status ${isOnline(u.last_seen_at)?'online':'offline'}">${isOnline(u.last_seen_at)?'オンライン':'オフライン'}</span></small></div><button class="btn secondary small" data-start-dm="${esc(u.id)}">DM</button></div>`).join(''):'<div class="empty-card">まだフレンドはいません。</div>';
    incoming?.querySelectorAll('[data-accept-friend]').forEach(b=>b.addEventListener('click',()=>respondFriendRequest(b.dataset.acceptFriend,true)));
    incoming?.querySelectorAll('[data-reject-friend]').forEach(b=>b.addEventListener('click',()=>respondFriendRequest(b.dataset.rejectFriend,false)));
    friends?.querySelectorAll('[data-start-dm]').forEach(b=>b.addEventListener('click',()=>startDMFromSearch(b.dataset.startDm)));
  }
  async function respondFriendRequest(id,accept){
    if(state.demo){const request=state.friendRequests.find(r=>r.id===id);state.friendRequests=state.friendRequests.filter(r=>r.id!==id);if(accept&&request?.profile)state.friends.push(request.profile);renderFriendLists();showToast(accept?'フレンドになりました（デモ）':'申請を拒否しました（デモ）');return;}
    const {error}=await db.rpc('respond_friend_request',{p_request_id:id,p_accept:accept});
    if(error)return showToast(friendlyError(error));
    showToast(accept?'フレンドになりました':'申請を拒否しました');await loadFriendsData();
  }

  async function startDMFromSearch(userId){
    let other;
    if(state.demo){
      other=[{id:'u1',username:'minto_7',display_name:'Minto',avatar_id:'🐱'},{id:'u2',username:'kota22',display_name:'Kota',avatar_id:'🌙'}].find(u=>u.id===userId);
      if(!other)return;
      let thread=state.dmThreads.find(t=>t.other?.id===userId);
      if(!thread){thread={id:`demo-thread-${userId}`,other,lastMessage:''};state.dmThreads.unshift(thread);}
      state.activeChat=thread.id;state.activeGroupId=null;state.activeChatUser=other;state.dmMessages=[...(state.demoDMStore[thread.id]||[])];state.page='chats';renderApp();return;
    }
    const {data:profile,error:profileError}=await db.from('profiles').select('id,username,display_name,avatar_id,last_seen_at').eq('id',userId).single();
    if(profileError)return showToast('ユーザー情報を読み込めませんでした');
    other=profile;
    const [low,high]=[state.user.id,userId].sort();
    let {data:thread,error}=await db.from('dm_threads').select('id,user_low,user_high,created_at').eq('user_low',low).eq('user_high',high).maybeSingle();
    if(error)return showToast('会話を開けませんでした: '+friendlyError(error));
    if(!thread){
      const inserted=await db.from('dm_threads').insert({user_low:low,user_high:high}).select('id,user_low,user_high,created_at').single();
      thread=inserted.data;
      if(inserted.error){const retry=await db.from('dm_threads').select('id,user_low,user_high,created_at').eq('user_low',low).eq('user_high',high).maybeSingle();thread=retry.data;if(!thread)return showToast('会話を作成できませんでした: '+friendlyError(inserted.error));}
    }
    state.activeChat=thread.id;state.activeGroupId=null;state.activeChatUser=other;state.page='chats';
    await loadDMThreads();await loadDMThreadMessages(thread.id);renderApp();subscribeDM(thread.id);
  }
  async function loadDMThreads(){
    if(state.demo){const list=$('#dm-thread-list');if(list)list.innerHTML=dmThreadListMarkup();bindDMThreadButtons();return;}
    if(!db||!state.user)return;
    const {data:threads,error}=await db.from('dm_threads').select('id,user_low,user_high,created_at').or(`user_low.eq.${state.user.id},user_high.eq.${state.user.id}`).order('created_at',{ascending:false});
    if(error){console.error(error);return;}
    const otherIds=[...new Set((threads||[]).flatMap(t=>[t.user_low,t.user_high]).filter(id=>id!==state.user.id))];
    const [{data:profiles},{data:messages}]=await Promise.all([
      otherIds.length?db.from('profiles').select('id,username,display_name,avatar_id,last_seen_at').in('id',otherIds):Promise.resolve({data:[]}),
      threads?.length?db.from('dm_messages').select('id,thread_id,content,sender_id,created_at,is_deleted').in('thread_id',threads.map(t=>t.id)).order('created_at',{ascending:false}):Promise.resolve({data:[]})
    ]);
    const profileMap=new Map((profiles||[]).map(p=>[p.id,p]));const lastMap=new Map();(messages||[]).forEach(m=>{if(!lastMap.has(m.thread_id))lastMap.set(m.thread_id,m);});
    state.dmThreads=(threads||[]).map(t=>{const other=profileMap.get(t.user_low===state.user.id?t.user_high:t.user_low);const last=lastMap.get(t.id);return {...t,other,lastMessage:last?(last.is_deleted?'メッセージは削除されました':last.content):'',lastActivity:last?.created_at||t.created_at};}).sort((a,b)=>new Date(b.lastActivity)-new Date(a.lastActivity));
    const list=$('#dm-thread-list');if(list)list.innerHTML=dmThreadListMarkup();bindDMThreadButtons();
  }
  function bindDMThreadButtons(){const list=$('#dm-thread-list');list?.querySelectorAll('[data-open-dm]').forEach(b=>b.addEventListener('click',()=>openDMThread(b.dataset.openDm)));}
  async function openDMThread(threadId){
    const thread=state.dmThreads.find(t=>t.id===threadId);if(!thread)return;
    state.activeChat=threadId;state.activeGroupId=null;state.activeChatUser=thread.other;state.dmMessages=[];
    if(state.demo){state.dmMessages=[...(state.demoDMStore[threadId]||[])];renderApp();return;}
    await loadDMThreadMessages(threadId);renderApp();subscribeDM(threadId);
  }
  async function loadDMThreadMessages(threadId){
    if(state.demo)return;
    const {data,error}=await db.from('dm_messages').select('id,thread_id,sender_id,content,is_deleted,edited_at,created_at').eq('thread_id',threadId).order('created_at',{ascending:true}).limit(200);
    if(error){console.error(error);showToast('メッセージを読み込めませんでした');return;}
    state.dmMessages=data||[];
  }
  function subscribeDM(threadId){
    if(!db)return;
    if(state.groupChannel){db.removeChannel(state.groupChannel);state.groupChannel=null;}
    if(state.dmChannel){db.removeChannel(state.dmChannel);state.dmChannel=null;}
    state.dmChannel=db.channel(`pasuchat-dm-${threadId}`).on('postgres_changes',{event:'*',schema:'public',table:'dm_messages',filter:`thread_id=eq.${threadId}`},async()=>{
      await loadDMThreadMessages(threadId);
      if(state.page==='chats'&&state.activeChat===threadId){const box=$('#chat-messages');if(box){box.innerHTML=state.dmMessages.length?state.dmMessages.map(dmMessageMarkup).join(''):'<div class="chat-empty">メッセージはまだありません。</div>';box.scrollTop=box.scrollHeight;}}
      loadDMThreads();
    }).subscribe();
  }
  async function sendDM(event){
    event.preventDefault();const content=String(new FormData(event.currentTarget).get('message')||'').trim();if(!content||!state.activeChat)return;
    if(state.demo){const message={id:`demo-msg-${Date.now()}`,thread_id:state.activeChat,sender_id:state.user.id,content,created_at:new Date().toISOString()};state.dmMessages.push(message);state.demoDMStore[state.activeChat]=[...(state.demoDMStore[state.activeChat]||[]),message];const thread=state.dmThreads.find(t=>t.id===state.activeChat);if(thread)thread.lastMessage=content;renderApp();return;}
    const {error}=await db.from('dm_messages').insert({thread_id:state.activeChat,sender_id:state.user.id,content});if(error)return showToast('送信できませんでした: '+friendlyError(error));event.currentTarget.reset();await loadDMThreadMessages(state.activeChat);await loadDMThreads();const box=$('#chat-messages');if(box)box.scrollTop=box.scrollHeight;
  }
  async function editDM(messageId){
    const message=state.dmMessages.find(m=>m.id===messageId);if(!message)return;const updated=prompt('メッセージを編集',message.content);if(updated===null)return;const content=updated.trim();if(!content)return showToast('空のメッセージにはできません');if(content.length>2000)return showToast('メッセージは2000文字以内です。');
    if(state.demo){message.content=content;message.edited_at=new Date().toISOString();state.demoDMStore[state.activeChat]=[...state.dmMessages];renderApp();return;}
    const {error}=await db.from('dm_messages').update({content,edited_at:new Date().toISOString()}).eq('id',messageId).eq('sender_id',state.user.id);if(error)return showToast('編集できませんでした');await loadDMThreadMessages(state.activeChat);renderApp();
  }
  async function deleteDM(messageId){
    if(!confirm('このメッセージを全員の画面から削除しますか？'))return;const message=state.dmMessages.find(m=>m.id===messageId);if(!message)return;
    if(state.demo){message.is_deleted=true;message.content='';state.demoDMStore[state.activeChat]=[...state.dmMessages];renderApp();return;}
    const {error}=await db.from('dm_messages').update({is_deleted:true}).eq('id',messageId).eq('sender_id',state.user.id);if(error)return showToast('削除できませんでした');await loadDMThreadMessages(state.activeChat);renderApp();
  }
  async function searchDMUsers(event){
    event.preventDefault();const term=$('#dm-user-search')?.value.trim().toLowerCase();if(!term)return showToast('ユーザー名を入力してください');const root=$('#dm-search-results');root.innerHTML='<div class="search-hint">検索中...</div>';
    let users=[];
    if(state.demo){users=[{id:'u1',username:'minto_7',display_name:'Minto',avatar_id:'🐱'},{id:'u2',username:'kota22',display_name:'Kota',avatar_id:'🌙'}].filter(u=>u.username.includes(term));}
    else {const {data,error}=await db.from('profiles').select('id,username,display_name,avatar_id').ilike('username',`%${term}%`).neq('id',state.user.id).limit(10);if(error){root.innerHTML='<div class="search-hint">検索できませんでした。</div>';return;}users=data||[];}
    root.innerHTML=users.length?users.map(u=>`<button class="dm-search-result" data-start-dm="${esc(u.id)}">${avatar(u.avatar_id,'small')}<span>@${esc(u.username)}</span></button>`).join(''):'<div class="search-hint">見つかりませんでした。</div>';
    root.querySelectorAll('[data-start-dm]').forEach(b=>b.addEventListener('click',()=>startDMFromSearch(b.dataset.startDm)));
  }

  async function loadGroupRooms(){
    if(state.demo){const root=$('#group-list');if(root)root.innerHTML=groupListMarkup();const invites=$('#group-invite-list');if(invites)invites.innerHTML=groupInviteListMarkup();bindGroupList();return;}
    if(!db||!state.user)return;
    const {data:members,error}=await db.from('group_members').select('group_id').eq('user_id',state.user.id);
    if(error){console.error(error);return;}
    const ids=[...new Set((members||[]).map(x=>x.group_id))];
    const {data:groups, error:groupError}=ids.length?await db.from('chat_groups').select('id,name,owner_id,created_at').in('id',ids).order('created_at',{ascending:false}):{data:[],error:null};
    if(groupError){console.error(groupError);return;}state.groups=groups||[];
    const root=$('#group-list');if(root)root.innerHTML=groupListMarkup();bindGroupList();
  }
  async function loadGroupInvites(){
    if(state.demo){const root=$('#group-invite-list');if(root)root.innerHTML=groupInviteListMarkup();bindGroupInviteButtons();return;}
    if(!db||!state.user)return;
    const {data:invites,error}=await db.from('group_invites').select('id,group_id,inviter_id,created_at').eq('invitee_id',state.user.id).eq('status','pending').order('created_at',{ascending:false});
    if(error){console.error('PasuChat group invites:',error);showToast('招待を読み込めませんでした: '+friendlyError(error));return;}
    const inviterIds=[...new Set((invites||[]).map(i=>i.inviter_id))];
    const groupIds=[...new Set((invites||[]).map(i=>i.group_id))];
    const [{data:profiles},{data:groups}]=await Promise.all([
      inviterIds.length?db.from('profiles').select('id,username,display_name').in('id',inviterIds):Promise.resolve({data:[]}),
      groupIds.length?db.from('chat_groups').select('id,name').in('id',groupIds):Promise.resolve({data:[]})
    ]);
    const profileMap=new Map((profiles||[]).map(p=>[p.id,p]));const groupMap=new Map((groups||[]).map(g=>[g.id,g]));
    state.groupInvites=(invites||[]).map(i=>({...i,inviter_name:profileMap.get(i.inviter_id)?.display_name||profileMap.get(i.inviter_id)?.username||'ユーザー',group_name:groupMap.get(i.group_id)?.name||'グループへの招待'}));
    const root=$('#group-invite-list');if(root)root.innerHTML=groupInviteListMarkup();bindGroupInviteButtons();
  }
  function bindGroupList(){const root=$('#group-list');root?.querySelectorAll('[data-open-group]').forEach(b=>b.addEventListener('click',()=>openGroup(b.dataset.openGroup)));}
  function bindGroupInviteButtons(){const root=$('#group-invite-list');root?.querySelectorAll('[data-accept-group-invite]').forEach(b=>b.addEventListener('click',()=>respondGroupInvite(b.dataset.acceptGroupInvite,true)));root?.querySelectorAll('[data-reject-group-invite]').forEach(b=>b.addEventListener('click',()=>respondGroupInvite(b.dataset.rejectGroupInvite,false)));}
  async function createGroup(){
    const name=prompt('グループ名を入力してください（40文字以内）');if(name===null)return;const clean=name.trim();if(!clean||clean.length>40)return showToast('グループ名は1〜40文字です。');
    if(state.demo){const group={id:`demo-group-${Date.now()}`,name:clean,owner_id:state.user.id,created_at:new Date().toISOString()};state.groups.unshift(group);state.activeGroupId=group.id;state.activeChat=null;state.groupMessages=[];state.demoGroupStore=state.demoGroupStore||{};state.demoGroupStore[group.id]=[];renderApp();return showToast('グループを作成しました（デモ）');}
    const {data,error}=await db.rpc('create_pasuchat_group',{p_name:clean});if(error)return showToast('グループを作成できませんでした: '+friendlyError(error));await loadGroupRooms();state.activeGroupId=data;state.activeChat=null;await loadGroupMessages(data);renderApp();subscribeGroup(data);
  }
  async function openGroup(groupId){const group=state.groups.find(g=>g.id===groupId);if(!group)return;state.activeGroupId=groupId;state.activeChat=null;state.groupMessages=[];if(state.demo){state.groupMessages=[...(state.demoGroupStore?.[groupId]||[])];renderApp();return;}await loadGroupMessages(groupId);renderApp();subscribeGroup(groupId);}
  async function loadGroupMessages(groupId){if(state.demo){state.groupMessages=[...(state.demoGroupStore?.[groupId]||[])];return;}const {data,error}=await db.from('group_messages').select('id,group_id,sender_id,content,is_deleted,edited_at,created_at').eq('group_id',groupId).order('created_at',{ascending:true}).limit(300);if(error){showToast('グループのメッセージを読み込めませんでした');return;}const senderIds=[...new Set((data||[]).map(m=>m.sender_id))];const {data:profiles}=senderIds.length?await db.from('profiles').select('id,display_name,username').in('id',senderIds):{data:[]};const map=new Map((profiles||[]).map(p=>[p.id,p]));state.groupMessages=(data||[]).map(m=>({...m,sender_name:map.get(m.sender_id)?.display_name||map.get(m.sender_id)?.username||'ユーザー'}));}
  function subscribeGroup(groupId){if(!db)return;if(state.dmChannel){db.removeChannel(state.dmChannel);state.dmChannel=null;}if(state.groupChannel){db.removeChannel(state.groupChannel);state.groupChannel=null;}state.groupChannel=db.channel(`pasuchat-group-${groupId}`).on('postgres_changes',{event:'*',schema:'public',table:'group_messages',filter:`group_id=eq.${groupId}`},async()=>{await loadGroupMessages(groupId);if(state.page==='chats'&&state.activeGroupId===groupId){const box=$('#group-messages');if(box){box.innerHTML=state.groupMessages.length?state.groupMessages.map(groupMessageMarkup).join(''):'<div class="chat-empty">まだメッセージはありません。</div>';box.scrollTop=box.scrollHeight;}}}).subscribe();}
  async function sendGroupMessage(event){event.preventDefault();const content=String(new FormData(event.currentTarget).get('message')||'').trim();if(!content||!state.activeGroupId)return;if(state.demo){const message={id:`demo-gm-${Date.now()}`,group_id:state.activeGroupId,sender_id:state.user.id,sender_name:state.profile.display_name,content,created_at:new Date().toISOString()};state.groupMessages.push(message);state.demoGroupStore=state.demoGroupStore||{};state.demoGroupStore[state.activeGroupId]=[...(state.demoGroupStore[state.activeGroupId]||[]),message];renderApp();return;}const {error}=await db.from('group_messages').insert({group_id:state.activeGroupId,sender_id:state.user.id,content});if(error)return showToast('送信できませんでした: '+friendlyError(error));event.currentTarget.reset();await loadGroupMessages(state.activeGroupId);}
  async function editGroupMessage(messageId){const message=state.groupMessages.find(m=>m.id===messageId);if(!message)return;const updated=prompt('メッセージを編集',message.content);if(updated===null)return;const content=updated.trim();if(!content)return showToast('空のメッセージにはできません');if(content.length>2000)return showToast('メッセージは2000文字以内です。');if(state.demo){message.content=content;message.edited_at=new Date().toISOString();state.demoGroupStore[state.activeGroupId]=[...state.groupMessages];renderApp();return;}const {error}=await db.from('group_messages').update({content,edited_at:new Date().toISOString()}).eq('id',messageId).eq('sender_id',state.user.id);if(error)return showToast('編集できませんでした');await loadGroupMessages(state.activeGroupId);renderApp();}
  async function deleteGroupMessage(messageId){if(!confirm('このメッセージを全員の画面から削除しますか？'))return;const message=state.groupMessages.find(m=>m.id===messageId);if(!message)return;if(state.demo){message.is_deleted=true;message.content='';state.demoGroupStore[state.activeGroupId]=[...state.groupMessages];renderApp();return;}const {error}=await db.from('group_messages').update({is_deleted:true}).eq('id',messageId).eq('sender_id',state.user.id);if(error)return showToast('削除できませんでした');await loadGroupMessages(state.activeGroupId);renderApp();}
  async function inviteFriendToGroup(event){
    event.preventDefault();
    const form=event.currentTarget;
    const friendId=String(new FormData(form).get('friendId')||'');
    if(!friendId||!state.activeGroupId)return showToast('招待するフレンドを選択してください');
    if(state.demo)return showToast('グループ招待を送りました（デモ）');
    const {data,error}=await db.rpc('pasuchat_invite_friend_to_group',{p_group_id:state.activeGroupId,p_invitee_id:friendId});
    if(error){console.error('PasuChat group invite:',error);return showToast('招待できませんでした: '+friendlyError(error));}
    showToast('グループ招待を送りました');
    form.reset();
  }
  async function respondGroupInvite(inviteId,accept){
    if(state.demo){const invite=state.groupInvites.find(i=>i.id===inviteId);state.groupInvites=state.groupInvites.filter(i=>i.id!==inviteId);if(accept&&invite){const group={id:invite.group_id,name:invite.group_name,owner_id:'u1',created_at:new Date().toISOString()};state.groups.unshift(group);state.demoGroupStore=state.demoGroupStore||{};state.demoGroupStore[invite.group_id]=[];}renderApp();showToast(accept?'グループに参加しました（デモ）':'招待を拒否しました（デモ）');return;}
    const invite=state.groupInvites.find(i=>i.id===inviteId);
    const {error}=await db.rpc('respond_group_invite',{p_invite_id:inviteId,p_accept:accept});
    if(error){console.error('PasuChat respond group invite:',error);return showToast(friendlyError(error));}
    showToast(accept?'グループに参加しました':'招待を拒否しました');
    await loadGroupInvites();
    if(accept){await loadGroupRooms();if(invite?.group_id)await openGroup(invite.group_id);}
  }

  function notificationsMarkup(){return `<div class="page-heading"><h2>通知</h2><p>新しいメッセージやフレンド申請などを確認できます。</p><button class="text-btn" id="mark-notifications-read">すべて既読にする</button></div><div class="notification-list">${state.notifications.map(n=>`<div class="notification-item ${n.is_read?'':'unread'} ${n.target_id?'clickable':''}" ${n.target_id?`role="button" tabindex="0" data-open-notification="${esc(n.id)}"`:''}><div class="avatar small">${n.notification_type==='friend_request'?'♙':n.notification_type==='like'?'♥':n.notification_type==='comment'?'▱':(n.notification_type==='group_invite'||n.notification_type==='group_message')?'▦':'✉'}</div><div><p>${esc(n.text||n.body)}</p><small>${shortDate(n.created_at)}</small></div></div>`).join('')||'<div class="empty-card"><div class="empty-icon">♢</div><strong>通知はありません</strong><p>新しい通知が届くと、ここに表示されます。</p></div>'}</div>`;}
  async function loadNotifications(){if(state.demo)return;if(!db||!state.user)return;const {data,error}=await db.from('notifications').select('id,notification_type,body,created_at,is_read,target_id').order('created_at',{ascending:false}).limit(50);if(error){console.error(error);return;}state.notifications=(data||[]).map(n=>({...n,text:n.body}));const list=$('#page-content');if(list&&state.page==='notifications'){list.innerHTML=notificationsMarkup();bindNotifications();}updateNotificationBadges();}
  function updateNotificationBadges(){
    const count=state.notifications.filter(n=>!n.is_read).length;
    app.querySelectorAll('[data-page="notifications"]').forEach(nav=>{let badge=nav.querySelector('.nav-count');if(count&&!badge){badge=document.createElement('span');badge.className='nav-count';nav.append(badge);}if(badge){if(count)badge.textContent=count;else badge.remove();}});
    const top=$('#top-notifications');if(top)top.innerHTML=`♢${count?'<i class="notification-dot"></i>':''}`;
  }
  function subscribeNotifications(){
    if(!db||!state.user)return;if(state.notificationsChannel)db.removeChannel(state.notificationsChannel);
    state.notificationsChannel=db.channel(`pasuchat-notifications-${state.user.id}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'notifications',filter:`recipient_id=eq.${state.user.id}`},payload=>{
      const n={...payload.new,text:payload.new.body};if(!state.notifications.some(item=>item.id===n.id))state.notifications.unshift(n);
      updateNotificationBadges();if(state.page==='notifications'){const list=$('#page-content');if(list){list.innerHTML=notificationsMarkup();bindNotifications();}}
      if(n.notification_type==='group_invite'&&state.page==='chats')loadGroupInvites();
      if(n.notification_type==='friend_request'&&state.page==='friends')loadFriendsData();
      showToast(n.text||'新しい通知が届きました');
    }).subscribe((status,error)=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')console.warn('PasuChat notifications realtime:',status,error);});
  }
  function subscribeFriendRequests(){
    if(!db||!state.user)return;if(state.friendRequestsChannel)db.removeChannel(state.friendRequestsChannel);
    state.friendRequestsChannel=db.channel(`pasuchat-friend-requests-${state.user.id}`).on('postgres_changes',{event:'*',schema:'public',table:'friend_requests',filter:`to_user=eq.${state.user.id}`},()=>{loadFriendsData();}).subscribe((status,error)=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')console.warn('PasuChat friend requests realtime:',status,error);});
  }
  async function markNotificationsRead(){if(state.demo){state.notifications.forEach(n=>n.is_read=true);renderApp();return;}const {error}=await db.from('notifications').update({is_read:true}).eq('recipient_id',state.user.id).eq('is_read',false);if(error)return showToast('通知を更新できませんでした');await loadNotifications();}
  function bindNotifications(){
    $('#mark-notifications-read')?.addEventListener('click',markNotificationsRead);
    app.querySelectorAll('[data-open-notification]').forEach(row=>{
      const open=()=>openNotification(row.dataset.openNotification);
      row.addEventListener('click',open);
      row.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}});
    });
  }
  async function openNotification(notificationId){
    const notification=state.notifications.find(item=>item.id===notificationId);
    if(!notification)return;
    if(!state.demo&&db&&state.user){
      const {error}=await db.from('notifications').update({is_read:true}).eq('id',notificationId).eq('recipient_id',state.user.id);
      if(error)console.warn('Could not mark notification read:',error);
    }
    notification.is_read=true;
    const type=notification.notification_type;
    if(type==='dm'&&notification.target_id){
      state.page='chats';await loadDMThreads();renderApp();
      if(state.dmThreads.some(thread=>thread.id===notification.target_id))await openDMThread(notification.target_id);
      else showToast('この会話を開けませんでした。');
    }else if(type==='group_message'&&notification.target_id){
      state.page='chats';await loadGroupRooms();renderApp();
      if(state.groups.some(group=>group.id===notification.target_id))await openGroup(notification.target_id);
      else showToast('このグループを開けませんでした。');
    }else if(type==='group_invite'){
      state.page='chats';renderApp();afterPageRender();
    }else if(type==='friend_request'){
      state.page='friends';renderApp();await loadFriendsData();
    }else if(type==='like'||type==='comment'){
      state.page='feed';state.openComments=null;await loadPosts();renderApp();
      if(type==='comment'&&notification.target_id)await loadComments(notification.target_id);
    }else{
      renderApp();
    }
    updateNotificationBadges();
  }
  function profileMarkup(){
    const p=state.profile||DEMO_USER;
    const isAdmin=Boolean(cfg.adminUserId&&state.user?.id===cfg.adminUserId&&!state.demo);
    return `<div class="page-heading"><h2>プロフィール</h2><p>ほかのユーザーに表示される情報を編集できます。</p></div><section class="profile-card"><div class="profile-top">${avatar(p.avatar_id,'large')}<div><h2>${esc(p.display_name||p.username)}</h2><p>@${esc(p.username)}</p></div></div><form id="profile-form"><div class="field"><label>表示名</label><input name="displayName" maxlength="24" value="${esc(p.display_name||'')}" required></div><div class="field"><label>自己紹介</label><textarea name="bio" rows="3" maxlength="120" placeholder="自己紹介を書こう...">${esc(p.bio||'')}</textarea></div><div class="field"><label>アイコンを選択</label><div class="avatar-picker">${AVATARS.map(a=>`<button type="button" class="avatar-option ${p.avatar_id===a?'selected':''}" data-avatar="${a}" aria-label="${a}">${a}</button>`).join('')}</div><input type="hidden" name="avatarId" id="avatar-id" value="${esc(p.avatar_id||AVATARS[0])}"></div><button class="btn" type="submit">変更を保存</button></form></section>
      ${isAdmin?`<section class="profile-card admin-tools"><h3>管理者ツール</h3><p>ユーザー名を指定して、新しい仮パスワードを設定できます。本人に安全な方法で新しいパスワードを伝えてください。</p><form id="admin-reset-form"><div class="field"><label>対象のユーザー名</label><input name="targetUsername" minlength="3" maxlength="20" pattern="[A-Za-z0-9_]{3,20}" required></div><div class="field"><label>新しい仮パスワード</label><input name="newPassword" type="password" minlength="8" maxlength="72" required></div><button class="btn" type="submit">パスワードを再設定</button></form></section>`:''}`;
  }
  async function saveProfile(event){event.preventDefault();const form=new FormData(event.currentTarget);const patch={display_name:String(form.get('displayName')).trim(),bio:String(form.get('bio')).trim(),avatar_id:String(form.get('avatarId'))};if(state.demo){Object.assign(state.profile,patch);renderApp();return showToast('プロフィールを更新しました（デモ）');}const {error}=await db.from('profiles').update(patch).eq('id',state.user.id);if(error)return showToast('保存できませんでした');Object.assign(state.profile,patch);renderApp();showToast('プロフィールを更新しました');}
  async function adminResetPassword(event){
    event.preventDefault();
    if(!db||!cfg.adminUserId||state.user?.id!==cfg.adminUserId)return showToast('管理者のみ利用できます。');
    const form=new FormData(event.currentTarget);const username=String(form.get('targetUsername')||'').trim().toLowerCase();const newPassword=String(form.get('newPassword')||'');
    if(!/^[a-z0-9_]{3,20}$/.test(username))return showToast('ユーザー名の形式を確認してください。');
    if(newPassword.length<8||newPassword.length>72)return showToast('仮パスワードは8〜72文字にしてください。');
    const button=event.currentTarget.querySelector('button[type=submit]');if(button)button.disabled=true;
    const {data,error}=await db.functions.invoke('admin-reset-password',{body:{username,newPassword}});
    if(button)button.disabled=false;
    if(error)return showToast('再設定できませんでした: '+friendlyError(error));
    event.currentTarget.reset();showToast(data?.message||'パスワードを再設定しました。');
  }

  async function logout(){for(const channel of [state.dmChannel,state.groupChannel,state.notificationsChannel,state.friendRequestsChannel])if(channel)db?.removeChannel(channel);state.dmChannel=state.groupChannel=state.notificationsChannel=state.friendRequestsChannel=null;if(state.onlineTimer){clearInterval(state.onlineTimer);state.onlineTimer=null;}if(state.demo){state.demo=false;state.user=null;state.profile=null;renderAuth();return;}await db.auth.signOut();state.user=null;state.profile=null;renderAuth();}
  function bindPage(){
    $('#publish-post')?.addEventListener('click',publishPost);
    app.querySelectorAll('[data-like]').forEach(b=>b.addEventListener('click',()=>toggleLike(b.dataset.like)));
    app.querySelectorAll('[data-comments]').forEach(b=>b.addEventListener('click',()=>loadComments(b.dataset.comments)));
    app.querySelectorAll('[data-delete-post]').forEach(b=>b.addEventListener('click',()=>deletePost(b.dataset.deletePost)));
    app.querySelectorAll('[data-comment-form]').forEach(f=>f.addEventListener('submit',e=>addComment(e,f.dataset.commentForm)));
    $('#search-users')?.addEventListener('click',searchUsers);$('#user-search')?.addEventListener('keydown',e=>{if(e.key==='Enter')searchUsers();});
    bindUserResults();
    $('#dm-search-form')?.addEventListener('submit',searchDMUsers);
    $('#chat-compose-form')?.addEventListener('submit',sendDM);
    $('#go-friends')?.addEventListener('click',()=>{state.page='friends';renderApp();afterPageRender();});
    $('#create-group')?.addEventListener('click',createGroup);
    $('#group-compose-form')?.addEventListener('submit',sendGroupMessage);
    $('#group-invite-form')?.addEventListener('submit',inviteFriendToGroup);
    app.querySelectorAll('[data-open-group]').forEach(b=>b.addEventListener('click',()=>openGroup(b.dataset.openGroup)));
    app.querySelectorAll('[data-edit-group-message]').forEach(b=>b.addEventListener('click',()=>editGroupMessage(b.dataset.editGroupMessage)));
    app.querySelectorAll('[data-delete-group-message]').forEach(b=>b.addEventListener('click',()=>deleteGroupMessage(b.dataset.deleteGroupMessage)));
    app.querySelectorAll('[data-accept-group-invite]').forEach(b=>b.addEventListener('click',()=>respondGroupInvite(b.dataset.acceptGroupInvite,true)));
    app.querySelectorAll('[data-reject-group-invite]').forEach(b=>b.addEventListener('click',()=>respondGroupInvite(b.dataset.rejectGroupInvite,false)));
    app.querySelectorAll('[data-open-dm]').forEach(b=>b.addEventListener('click',()=>openDMThread(b.dataset.openDm)));
    app.querySelectorAll('[data-edit-message]').forEach(b=>b.addEventListener('click',()=>editDM(b.dataset.editMessage)));
    app.querySelectorAll('[data-delete-message]').forEach(b=>b.addEventListener('click',()=>deleteDM(b.dataset.deleteMessage)));
    bindNotifications();
    $('#profile-form')?.addEventListener('submit',saveProfile);
    $('#admin-reset-form')?.addEventListener('submit',adminResetPassword);
    app.querySelectorAll('[data-avatar]').forEach(b=>b.addEventListener('click',()=>{$('#avatar-id').value=b.dataset.avatar;app.querySelectorAll('[data-avatar]').forEach(x=>x.classList.toggle('selected',x===b));}));
  }

  if(configured) {
    db.auth.getSession().then(async ({data,error})=>{
      if(error){console.error('PasuChat session initialization:',error);renderAuth();showToast('ログイン状態を確認できませんでした。再度ログインしてください。');return;}
      if(data?.session){try{await loadSession();}catch(initError){console.error(initError);renderAuth();showToast('初期化に失敗しました。ページを再読み込みしてください。');}}
      else renderAuth();
    }).catch(error=>{console.error('PasuChat startup:',error);renderAuth();showToast('接続を確認できませんでした。');});
  } else renderAuth();
})();
