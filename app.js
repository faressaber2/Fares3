
/* ══ SPLASH: في PWA — يظهر عند كل فتح للتطبيق ══ */
(function(){
  var splash = document.getElementById('native-splash');
  if(!splash) return;
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  if(isStandalone){
    splash.style.display = 'flex';
    setTimeout(function(){
      splash.classList.add('hide');
      setTimeout(function(){ splash.style.display='none'; }, 650);
    }, 2000);
  }
})();

/* ════════ CONFIG ════════ */
var ADMIN_PHONE = '201040986955';
var CLOUDINARY_CLOUD = 'dkq9kctcv';
var CLOUDINARY_PRESET = 'fares7877';
var ADMIN_PASS  = 'fares2025';
var ADMIN_NUMBER = '01040986955'; // local format

/* ════════ SUPABASE CONFIG ════════ */
var SUPABASE_URL = 'https://pmraekoodbxgnybpvkzg.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtcmFla29vZGJ4Z255YnB2a3pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMTk5MDksImV4cCI6MjA4ODg5NTkwOX0.f7mYHBT0d_0DHrC_o6n6MZeQz1B5RcHkklP6mZJXXjY';

/* ════════ SECURITY: HTML ESCAPE (XSS Prevention) ════════ */
function escapeHTML(str){
  if(str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

/* ════════ PASSWORD SECURITY ════════ */
async function hashPassword(password){
  try{
    var encoder = new TextEncoder();
    var data = encoder.encode(password + 'diyar_salt_2025');
    var hashBuffer = await crypto.subtle.digest('SHA-256', data);
    var hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2,'0')).join('');
  } catch(e){ return password; } // fallback if crypto not available
}
async function verifyPassword(input, stored){
  if(!stored) return false;
  // Support legacy plain passwords (migration)
  if(stored.length !== 64) return input === stored;
  var hashed = await hashPassword(input);
  return hashed === stored;
}

/* ════════ STATE ════════ */
var propType='', dealType='', nearSea='', finishVal='', aptFurnish='', aptPayment='';
var _vsAllAds=[], _vsPage=0, _vsPageSize=25, _vsLoading=false;
var selectedChips={}, uploadedPhotos=[];
var currentFilter='الكل';
var currentSort='default';
var headerTaps=0, headerTimer;
var currentUser = null; // {phone, isAdmin}
var _otpCode = '';
var featuredEnabled = false;

/* ════════ AD CODE COUNTER ════════ */
var _adCodeLock = Promise.resolve(); // mutex — يمنع استدعاءين متزامنين يولّدان نفس الكود
async function getNextAdCode(){
  var result = await (_adCodeLock = _adCodeLock.then(async function(){
    try{
      var rows = await sbFetch('settings?key=eq.ad_counter&select=key,value');
      var current = (rows && rows.length) ? (parseInt(rows[0].value)||100) : 100;
      var next = current + 1;
      var _sc = new AbortController();
      var _st = setTimeout(function(){ _sc.abort(); }, 10000);
      try{
        await fetch(SUPABASE_URL + '/rest/v1/settings', {
          method:'POST',
          signal: _sc.signal,
          headers:{
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=representation'
          },
          body: JSON.stringify({key:'ad_counter', value: String(next)})
        });
      } finally { clearTimeout(_st); }
      localStorage.setItem('fares_ad_counter', next);
      return 'MT-' + next;
    } catch(e){
      var n = parseInt(localStorage.getItem('fares_ad_counter')||'100') + 1;
      localStorage.setItem('fares_ad_counter', n);
      return 'MT-' + n;
    }
  }).catch(function(e){
    var n = parseInt(localStorage.getItem('fares_ad_counter')||'100') + 1;
    localStorage.setItem('fares_ad_counter', n);
    return 'MT-' + n;
  }));
  return result;
}

/* ════════ VIEWS ════════ */
function loadViews(){ try{return JSON.parse(localStorage.getItem('fares_views')||'{}')}catch(e){return {};} }
function saveViews(v){ localStorage.setItem('fares_views', JSON.stringify(v)); }
function getViews(id){ var v=loadViews(); return v[id]||0; }
function incrementViews(id){
  var v=loadViews(); v[id]=(v[id]||0)+1; saveViews(v);
  // مزامنة في الخلفية مع Supabase
  (async function(){
    try{
      await fetch(SUPABASE_URL + '/rest/v1/settings', {
        method:'POST',
        headers:{
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({key:'views_'+id, value: String(v[id])})
      });
    } catch(e){ /* صامت */ }
  })();
  return v[id];
}

/* ════════ FAVORITES ════════ */
function loadFavs(){ try{return JSON.parse(localStorage.getItem('fares_favs')||'[]')}catch(e){return [];} }
function saveFavs(f){ localStorage.setItem('fares_favs', JSON.stringify(f)); }
function isFav(id){ return loadFavs().indexOf(id)!==-1; }
function toggleFav(id, event){
  if(event) event.stopPropagation();
  var f=loadFavs(), idx=f.indexOf(id);
  if(idx===-1){ f.push(id); saveFavs(f); toast('❤️ أُضيف للمفضلة'); }
  else { f.splice(idx,1); saveFavs(f); toast('💔 أُزيل من المفضلة'); }
  var btn=document.getElementById('fav-'+id);
  if(btn){ btn.textContent=isFav(id)?'❤️':'🤍'; btn.classList.toggle('on',isFav(id)); }
  updateFavsCard();
}
function updateFavsCard(){
  var f=loadFavs(), card=document.getElementById('favs-card');
  if(!card) return;
  if(f.length>0){ card.style.display='flex'; var _fcs=document.getElementById('favs-card-sub'); if(_fcs) _fcs.textContent=f.length+' عقار محفوظ'; }
  else card.style.display='none';
}
function renderFavs(){
  var f=loadFavs();
  var sub=document.getElementById('favs-sub'), grid=document.getElementById('favs-grid');
  var cachedDb=loadDB();
  // عرض من الـ cache فوراً لو فيه بيانات
  var favAds=(cachedDb.approved||[]).filter(a=>f.indexOf(a.id)!==-1);
  if(favAds.length){
    sub.textContent = favAds.length + ' عقار محفوظ';
    grid.innerHTML = buildAdCards(favAds);
  } else {
    sub.textContent='';
    grid.innerHTML='<div style="text-align:center;padding:40px 20px;color:#8a9ab8"><div style="font-size:36px;margin-bottom:12px">⏳</div><div style="font-size:14px;font-weight:700">جاري التحميل...</div></div>';
  }
  // تحديث من Supabase دايماً
  loadDBAsync().then(function(db){
    var favAds2=(db.approved||[]).filter(a=>f.indexOf(a.id)!==-1);
    if(!favAds2.length){
      sub.textContent='';
      grid.innerHTML='<div class="favs-empty"><div class="eico">🤍</div><div style="font-weight:700;font-size:16px;color:#1a2744;margin-bottom:6px">لا توجد مفضلات بعد</div><div style="font-size:13px">اضغط ❤️ على أي إعلان لحفظه</div></div>';
      return;
    }
    sub.textContent = favAds2.length + ' عقار محفوظ';
    grid.innerHTML = buildAdCards(favAds2);
  }).catch(function(){/* الـ cache يكفي */});
}
/* transferPhoto: يُستخدم داخل دوال النموذج فقط */

async function _upsertAdSB(ad, status, _retry){
  var controller = new AbortController();
  var timer = setTimeout(function(){ controller.abort(); }, 30000);
  var body = JSON.stringify({id: ad.id, data: ad, status: status, updated_at: new Date().toISOString()});
  try{
    var res = await fetch(SUPABASE_URL + '/rest/v1/ads', {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: body,
      signal: controller.signal
    });
    if(!res.ok){
      var err = null; try{ err = await res.json(); }catch(e){}
      throw new Error((err && (err.message||err.error)) || ('HTTP ' + res.status));
    }
  } catch(err){
    if(err.name === 'AbortError'){
      if(!_retry){
        // إعادة المحاولة مرة واحدة تلقائياً قبل الاستسلام
        return await _upsertAdSB(ad, status, true);
      }
      throw new Error('انتهت مهلة الاتصال بالسيرفر، تحقق من سرعة الإنترنت وحاول مجدداً');
    }
    throw err;
  } finally { clearTimeout(timer); }
}

async function sbFetch(path, opts){
  var controller = new AbortController();
  var timer = setTimeout(function(){ controller.abort(); }, 20000);
  opts = opts || {};
  var method = (opts.method || 'GET').toUpperCase();
  var finalHeaders = Object.assign({
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Accept': 'application/json'
  }, method !== 'GET' ? {'Content-Type': 'application/json'} : {}, opts.headers || {});
  var fetchOpts = Object.assign({}, opts, { signal: controller.signal, headers: finalHeaders });
  try{
    var res = await fetch(SUPABASE_URL + '/rest/v1/' + path, fetchOpts);
    if(!res.ok){
      var errBody = null;
      try{ errBody = await res.json(); }catch(e){}
      var errMsg = (errBody && (errBody.message||errBody.error||errBody.hint))
        ? (errBody.message||errBody.error)
        : ('HTTP ' + res.status);
      // رسائل توضيحية للأخطاء الشائعة
      if(res.status === 401 || res.status === 403){
        errMsg = 'خطأ في الصلاحيات (RLS) — راجع إعدادات Supabase (' + errMsg + ')';
      } else if(res.status === 404){
        errMsg = 'الجدول غير موجود في قاعدة البيانات — شغّل supabase_setup.sql أولاً';
      }
      console.error('sbFetch error [' + method + ' ' + path + ']:', res.status, errBody);
      throw new Error(errMsg);
    }
    if(res.status === 204) return [];
    try{ return await res.json(); }catch(e){ return []; }
  } catch(err){
    if(err.name === 'AbortError') throw new Error('انتهت مهلة الاتصال بالسيرفر');
    if(!navigator.onLine) throw new Error('لا يوجد اتصال بالإنترنت');
    throw err;
  } finally { clearTimeout(timer); }
}

/* ════════ STORAGE — Supabase + localStorage fallback ════════ */
var _dbCache = null;
var _dbCacheTime = 0;       // timestamp آخر fetch ناجح
var _dbFetchPromise = null; // منع طلبات متوازية

async function loadDBAsync(forceRefresh){
  // لو في fetch جاري — انتظره إلا لو طلبنا تحديث إجباري
  if(_dbFetchPromise && !forceRefresh) return _dbFetchPromise;

  // لو الـ cache طازج (أقل من 60 ثانية) ومش مطلوب تحديث إجباري
  var cacheAge = Date.now() - _dbCacheTime;
  if(!forceRefresh && _dbCache && cacheAge < 60000) return _dbCache;

  _dbFetchPromise = (async function(){
    try{
      var rows = await sbFetch('ads?select=id,data,status&order=updated_at.desc');
      if(!rows || !Array.isArray(rows)) throw new Error('no data');
      var pending = [], approved = [];
      rows.forEach(function(r){
        if(!r.data || typeof r.data !== 'object') return;
        var ad = Object.assign({}, r.data, {id: r.id, _sbStatus: r.status});
        if(r.status === 'approved') approved.push(ad);
        else pending.push(ad);
      });
      var db = {pending: pending, approved: approved};
      _dbCache = db;
      _dbCacheTime = Date.now();
      try{ localStorage.setItem('fares_db_cache', JSON.stringify(db)); }catch(e){}
      return db;
    } catch(e){
      console.error('loadDBAsync error:', e.message);
      // تحذير مرئي لو المشكلة من قاعدة البيانات (ليس من الإنترنت)
      if(navigator.onLine && (e.message.includes('RLS') || e.message.includes('غير موجود') || e.message.includes('404') || e.message.includes('403'))){
        console.warn('[ديار] مشكلة في Supabase:', e.message, '— شغّل supabase_setup.sql لإصلاح المشكلة');
      }
      if(!_dbCache){
        try{
          var saved = localStorage.getItem('fares_db_cache');
          if(saved){ _dbCache = JSON.parse(saved); }
        }catch(_e){}
      }
      return _dbCache || {pending:[], approved:[]};
    } finally {
      _dbFetchPromise = null;
    }
  })();
  return _dbFetchPromise;
}

function loadDB(){
  if(_dbCache) return _dbCache;
  // ✅ FIX 2: استرجع من localStorage لو الـ cache فاضي (بعد إغلاق التطبيق وفتحه)
  try{
    var saved = localStorage.getItem('fares_db_cache');
    if(saved){ _dbCache = JSON.parse(saved); return _dbCache; }
  }catch(e){}
  return {pending:[], approved:[]};
}

async function saveAdToSB(ad, status){
  status = status || 'pending';
  await _upsertAdSB(ad, status);
  _dbCacheTime = 0; // أبطل الـ cache عشان الـ fetch الجاي يجيب أحدث
  try{ await loadDBAsync(true); } catch(e){}
}

async function deleteAdFromSB(id){
  var controller = new AbortController();
  var timer = setTimeout(function(){ controller.abort(); }, 30000);
  try{
    var res = await fetch(SUPABASE_URL + '/rest/v1/ads?id=eq.'+id, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    });
    _dbCacheTime = 0;
    if(!res.ok) console.error('deleteAdFromSB failed:', res.status);
  } catch(err){
    _dbCacheTime = 0;
    if(err.name !== 'AbortError') console.error('deleteAdFromSB error:', err.message);
  } finally { clearTimeout(timer); }
}

function saveDB(db){
  if(!db) return;
  if(!db.pending) db.pending=[];
  if(!db.approved) db.approved=[];
  _dbCache = db;
  // ✅ FIX: احفظ في localStorage عشان التعديلات المحلية تتحفظ
  try{ localStorage.setItem('fares_db_cache', JSON.stringify(db)); }catch(e){}
}

var _usersCache = null;
async function loadUsersAsync(){
  try{
    var rows = await sbFetch('users?select=*');
    if(!rows || !Array.isArray(rows)) throw new Error('no data');
    // Normalize snake_case keys from Supabase to camelCase used throughout the app
    var normalized = rows.map(function(r){
      return Object.assign({}, r, {
        joinedAt: r.joinedAt || r.joined_at || '',
        profile_name: r.profile_name != null ? r.profile_name : '',
        profile_type: r.profile_type != null ? r.profile_type : '',
        profile_phone: r.profile_phone != null ? r.profile_phone : '',
        profile_photo: r.profile_photo != null ? r.profile_photo : ''
        // password يُنسخ تلقائياً من Object.assign({}, r, ...)
      });
    });
    _usersCache = normalized;
    // ✅ FIX 3: احفظ المستخدمين في localStorage
    try{ localStorage.setItem('fares_users_cache', JSON.stringify(normalized)); }catch(e){}
    return normalized;
  } catch(e){
    console.error('loadUsersAsync error:', e.message);
    // ✅ FIX 3: استرجع من localStorage لو فشل الاتصال
    if(!_usersCache){
      try{
        var savedU = localStorage.getItem('fares_users_cache');
        if(savedU){ _usersCache = JSON.parse(savedU); }
      }catch(_e){}
    }
    return _usersCache || [];
  }
}
function loadUsers(){
  if(_usersCache) return _usersCache;
  // ✅ FIX 4: استرجع من localStorage لو الـ cache فاضي
  try{
    var savedU = localStorage.getItem('fares_users_cache');
    if(savedU){ _usersCache = JSON.parse(savedU); return _usersCache; }
  }catch(e){}
  return [];
}
async function saveUserToSB(user){
  var _uctrl = new AbortController();
  var _utimer = setTimeout(function(){ _uctrl.abort(); }, 30000);
  try{
    var payload = {
      phone: user.phone,
      blocked: user.blocked||false,
      joined_at: user.joinedAt || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    if(user.profile_name) payload.profile_name = user.profile_name;
    if(user.profile_type) payload.profile_type = user.profile_type;
    if(user.profile_phone) payload.profile_phone = user.profile_phone;
    if(user.profile_photo !== undefined) payload.profile_photo = user.profile_photo;
    if(user.password) payload.password = user.password;
    if(user.verified !== undefined) payload.verified = user.verified;
    var _ures = await fetch(SUPABASE_URL + '/rest/v1/users', {
      method: 'POST',
      signal: _uctrl.signal,
      headers:{
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(payload)
    });
    if(!_ures.ok){ var _ue=null; try{_ue=await _ures.json();}catch(e){} console.error('saveUserToSB failed:', _ures.status, _ue); }
  } catch(e){ console.error('saveUserToSB error:', e.message); }
  finally { clearTimeout(_utimer); }
}
function saveUsers(u){
  _usersCache = u;
  // ✅ FIX: احفظ في localStorage عشان المستخدمين الجدد يتحفظوا
  try{ localStorage.setItem('fares_users_cache', JSON.stringify(u)); }catch(e){}
}

var _settingsCache = null;
async function loadSettingsAsync(){
  try{
    var rows = await sbFetch('settings?select=key,value');
    if(!rows || !Array.isArray(rows)) throw new Error('fail');
    var s = {};
    rows.forEach(function(r){ try{ s[r.key]=JSON.parse(r.value); }catch(e){ s[r.key]=r.value; } });
    _settingsCache = s;
    // ✅ FIX 5: احفظ الإعدادات في localStorage
    try{ localStorage.setItem('fares_settings_cache', JSON.stringify(s)); }catch(e){}
    return s;
  } catch(e){
    console.error('loadSettingsAsync error:', e.message);
    // ✅ FIX 5: استرجع من localStorage لو فشل الاتصال
    if(!_settingsCache){
      try{
        var savedS = localStorage.getItem('fares_settings_cache');
        if(savedS){ _settingsCache = JSON.parse(savedS); }
      }catch(_e){}
    }
    return _settingsCache || {};
  }
}
function loadSettings(){
  if(_settingsCache) return _settingsCache;
  // ✅ FIX 6: استرجع من localStorage لو الـ cache فاضي
  try{
    var savedS = localStorage.getItem('fares_settings_cache');
    if(savedS){ _settingsCache = JSON.parse(savedS); return _settingsCache; }
  }catch(e){}
  return {};
}
async function saveSettingsToSB(s){
  try{
    var rows = Object.keys(s).map(function(k){ return {key:k, value: JSON.stringify(s[k])}; });
    for(var i=0;i<rows.length;i++){
      var _sc = new AbortController();
      var _st = setTimeout(function(){ _sc.abort(); }, 15000);
      try{
        await fetch(SUPABASE_URL + '/rest/v1/settings', {
          method:'POST',
          signal: _sc.signal,
          headers:{
            'apikey': SUPABASE_KEY,
            'Authorization': 'Bearer ' + SUPABASE_KEY,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=representation'
          },
          body: JSON.stringify(rows[i])
        });
      } finally { clearTimeout(_st); }
    }
  } catch(e){}
}
function saveSettings2(s){
  _settingsCache = s;
  saveSettingsToSB(s);
}

/* ════════ OTP SYSTEM ════════ */
/* ════════ LOGIN STARS ════════ */
(function(){
  var container = document.getElementById('otp-stars-bg');
  if(!container) return;
  for(var i=0;i<60;i++){
    var s = document.createElement('div');
    s.className = 'otp-star';
    s.style.cssText = 'left:'+Math.random()*100+'%;top:'+Math.random()*100+'%;--d:'+(2+Math.random()*4)+'s;--delay:'+(Math.random()*4)+'s;opacity:'+(Math.random()*.5+.1);
    container.appendChild(s);
  }
})();

function getSavedPhones(){
  try{ return JSON.parse(localStorage.getItem('fares_saved_phones')||'[]'); }catch(e){return [];}
}
function savePhone(phone){
  var phones = getSavedPhones();
  phones = phones.filter(p=>p!==phone); // ازل لو موجود
  phones.unshift(phone); // حطه في الأول
  phones = phones.slice(0,5); // احتفظ بآخر 5 بس
  localStorage.setItem('fares_saved_phones', JSON.stringify(phones));
}
function loadSavedPhones(){
  var phones = getSavedPhones();
  var wrap = document.getElementById('saved-phones-wrap');
  var list = document.getElementById('saved-phones-list');
  if(!phones.length){ wrap.style.display='none'; return; }
  wrap.style.display='block';
  list.innerHTML = phones.map(function(p){
    var label = p === '01040986955' ? p + ' 👑' : p;
    return '<button class="saved-phone-btn" onclick="selectSavedPhone(\''+p+'\')">'+
      '<span>'+label+'</span><span style="color:#8a95a8;font-size:11px">اختر</span>'+
    '</button>';
  }).join('');
}
function selectSavedPhone(phone){
  document.getElementById('otp-phone').value = phone;
  var pwInp = document.getElementById('otp-password');
  if(pwInp) { pwInp.focus(); pwInp.value=''; }
}
async function loginWithPhone(){
  var phone = document.getElementById('otp-phone').value.trim();
  var password = document.getElementById('otp-password') ? document.getElementById('otp-password').value.trim() : '';
  if(!/^(010|011|012|015)\d{8}$/.test(phone)){
    toast('⚠️ أدخل رقم هاتف مصري صحيح'); return;
  }
  if(!password || password.length < 4){
    toast('⚠️ أدخل كلمة مرور (4 أحرف على الأقل)'); return;
  }
  var isAdmin = (phone === '01040986955');
  if(isAdmin){
    // استخدم كلمة السر من الإعدادات (متسقة مع adminLogin)
    var _s = loadSettings();
    var _storedAdminPass = _s.adminPass || ADMIN_PASS;
    if(password !== _storedAdminPass){
      toast('⚠️ كلمة السر غير صحيحة'); return;
    }
  }

  // تحقق من كلمة السر للمستخدمين العاديين
  // جيب أحدث بيانات المستخدمين من Supabase (مهم للتحقق من الحظر)
  if(!isAdmin){
    try{ await loadUsersAsync(); } catch(e){}
  }
  var users = loadUsers();
  var existingUser = users.find(u => u.phone === phone);

  // Fix 3: فحص المستخدم المحظور قبل أي شيء آخر
  if(existingUser && existingUser.blocked && !isAdmin){
    toast('🚫 حسابك محظور — تواصل مع الإدارة');
    return;
  }

  if(existingUser && !isAdmin){
    // مستخدم موجود - تحقق من كلمة السر
    var passwordOk = await verifyPassword(password, existingUser.password);
    if(existingUser.password && !passwordOk){
      toast('❌ كلمة المرور غير صحيحة لهذا الرقم'); return;
    }
    // لو مفيش password محفوظ أو legacy - حفظ hashed
    if(!existingUser.password || existingUser.password.length !== 64){
      existingUser.password = await hashPassword(password);
      saveUsers(users);
      saveUserToSB(existingUser);
    }
  } else if(!existingUser && !isAdmin){
    // مستخدم جديد - سجّله مع كلمة السر hashed
    var hashedPw = await hashPassword(password);
    var newUser = {phone, password: hashedPw, blocked:false, joinedAt:new Date().toLocaleString('ar-EG')};
    users.push(newUser);
    saveUsers(users);
    saveUserToSB(newUser);
  }

  savePhone(phone);
  currentUser = {phone, isAdmin};
  localStorage.setItem('fares_current_user', JSON.stringify({phone, isAdmin}));
  var _oldP=loadBrokerProfile();
  if(_oldP && _oldP.linkedPhone && _oldP.linkedPhone!==phone){ localStorage.removeItem('fares_broker_profile'); }
  var _otpEl=document.getElementById('otp-overlay'); if(_otpEl) _otpEl.style.display='none';
  updateUserBadge();
  // عرض الإعلانات من الـ cache المحفوظ فوراً (قبل Supabase)
  updateMyAdsCard();
  updateBrokerHomeCard();
  if('Notification' in window && Notification.permission === 'default'){
    Notification.requestPermission();
  }
  if(!isAdmin){
    // استعادة الملف الشخصي والإعلانات معاً من Supabase
    restoreUserSession(phone);
  }
  if(isAdmin){
    var _fabEl=document.getElementById('admin-fab'); if(_fabEl) _fabEl.style.display='flex';
    toast('🎉 مرحباً بك يا أدمن!');
    setTimeout(()=>openAdmin(),600);
  } else {
    toast('🎉 تم الدخول بنجاح');
  }
  startRealtimeSync();
}

/* ════════ RESTORE SESSION ════════ */
/* تُستدعى بعد الدخول — تستعيد الملف الشخصي والإعلانات معاً من Supabase */
async function restoreUserSession(phone){
  // 1. استعادة الملف الشخصي
  await restoreUserProfile(phone);
  // 2. تحديث الإعلانات من Supabase وعرضها فوراً
  try{
    await loadDBAsync(true); // forceRefresh = true
    updateMyAdsCard();
    updateBrokerHomeCard();
    // لو صفحة "إعلاناتي" مفتوحة — حدّثها
    var _ms = document.getElementById('s-myads');
    if(_ms && _ms.classList.contains('active')) _doRenderMyAds();
  } catch(e){
    // الـ cache الموجود كافٍ كـ fallback
    updateMyAdsCard();
  }
}

async function restoreUserProfile(phone){
  try{
    // جيب من Supabase دايماً عشان نضمن آخر البيانات
    var rows = await sbFetch('users?phone=eq.'+encodeURIComponent(phone)+'&select=*');
    if(rows && rows.length){
      var row = rows[0];
      // حدّث localStorage للمستخدمين
      var users = loadUsers();
      var idx = users.findIndex(function(u){ return u.phone === phone; });
      if(idx !== -1){
        users[idx] = Object.assign(users[idx], row);
      } else {
        users.push(row);
      }
      saveUsers(users);
      // استعادة بيانات السمسار/المالك
      if(row.profile_name){
        var profile = {
          name: row.profile_name,
          phone: row.profile_phone || phone,
          accountType: row.profile_type,
          photo: row.profile_photo || '',
          linkedPhone: phone,
          verified: row.verified || false
        };
        saveBrokerProfile(profile);
        updateBrokerHomeCard();
        toast('👋 مرحباً ' + profile.name + '!');
      } else {
        var existingProfile = loadBrokerProfile();
        if(existingProfile && existingProfile.linkedPhone === phone){
          updateBrokerHomeCard();
        }
      }
    } else {
      // مش موجود في Supabase — جرب localStorage
      var existingLocal = loadBrokerProfile();
      if(existingLocal && existingLocal.linkedPhone === phone){
        updateBrokerHomeCard();
      }
    }
  } catch(e){
    var existingFallback = loadBrokerProfile();
    if(existingFallback && existingFallback.linkedPhone === phone){
      updateBrokerHomeCard();
    }
  }
}
function sendOTP(){ loginWithPhone(); }
function verifyOTP(){}
function digitInput(){}
function digitBack(){}
function skipLogin(){
  toast('⚠️ يجب تسجيل الدخول أولاً');
}
function backToPhone(){
  var _s2=document.getElementById('otp-step2');if(_s2)_s2.classList.remove('active');
  var _s1=document.getElementById('otp-step1');if(_s1)_s1.classList.add('active');
}
function updateUserBadge(){
  if(!currentUser) return;
  var wrap = document.getElementById('user-badge-wrap');
  var txt = document.getElementById('user-badge-text');
  if(wrap) wrap.style.display='block';
  if(txt) txt.textContent = currentUser.isAdmin ? '👑 أدمن' : '📱 '+currentUser.phone.slice(-4);
}
function showUserMenu(){
  if(currentUser&&currentUser.isAdmin){openAdmin();return;}
  var r = confirm('هل تريد تسجيل الخروج؟');
  if(r){
    // احتفظ بكل البيانات غير المرتبطة بالجلسة
    var savedPhones   = localStorage.getItem('fares_saved_phones');
    var savedDb       = localStorage.getItem('fares_db_cache');
    var savedViews    = localStorage.getItem('fares_views');
    var savedSettings = localStorage.getItem('fares_settings_cache');
    var savedUsers    = localStorage.getItem('fares_users_cache');
    localStorage.clear();
    if(savedPhones)   localStorage.setItem('fares_saved_phones',   savedPhones);
    if(savedDb)       localStorage.setItem('fares_db_cache',       savedDb);
    if(savedViews)    localStorage.setItem('fares_views',          savedViews);
    if(savedSettings) localStorage.setItem('fares_settings_cache', savedSettings);
    if(savedUsers)    localStorage.setItem('fares_users_cache',     savedUsers);
    currentUser = null;
    uploadedPhotos = [];
    _usersCache = null;
    _settingsCache = null;
    // أوقف المزامنة التلقائية عند تسجيل الخروج
    if(_realtimeInterval){ clearInterval(_realtimeInterval); _realtimeInterval = null; }
    // _dbCache و _dbCacheTime يبقيان لتسريع الدخول التالي
    var _ubw=document.getElementById('user-badge-wrap'); if(_ubw) _ubw.style.display='none';
    var _afb=document.getElementById('admin-fab'); if(_afb) _afb.style.display='none';
    document.getElementById('broker-home-card').style.display='none';
    document.getElementById('visitor-choices').style.display='block';
    var _oto=document.getElementById('otp-overlay'); if(_oto) _oto.style.display='flex';
    loadSavedPhones();
    updateBrokerHomeCard();
    toast('👋 تم تسجيل الخروج بأمان');
  }
}

/* ════════ FEATURED TOGGLE ════════ */
function toggleFeaturedOption(){
  featuredEnabled = !featuredEnabled;
  var sw = document.getElementById('featured-toggle-sw');
  var box = document.getElementById('featured-payment-box');
  sw.classList.toggle('on', featuredEnabled);
  box.style.display = featuredEnabled ? 'block' : 'none';
  if(featuredEnabled) updateFormFeaturedPrices();
}

function updateFormFeaturedPrices(){
  var s = loadSettings();
  var price  = s.featuredPrice || '50';
  var wallet = s.vodafoneNum   || '01005581620';
  ['form-feat-price-hint','form-feat-price-sub','form-feat-price-pill'].forEach(function(id){
    var el=document.getElementById(id); if(el) el.textContent=price;
  });
  var fw=document.getElementById('form-feat-wallet'); if(fw) fw.textContent=wallet;
}

function sendFeaturedRequest(){
  var settings = loadSettings();
  var waNum = (settings.adminWa||ADMIN_NUMBER).replace(/^0/,'20');
  var price = settings.featuredPrice || '50';
  var pl={apt:'شقة / بيت',land:'أرض',shop:'محل'};
  var dl={sale:'تمليك',rent:'إيجار'};
  var name    = document.getElementById('owner-name').value.trim() || '—';
  var phone   = document.getElementById('phone').value.trim() || '—';
  var region  = document.getElementById('region').value || '—';
  var adPrice = document.getElementById('price').value;
  var size    = document.getElementById('size').value;
  var desc    = document.getElementById('desc').value.trim();
  var rentType = dealType==='rent'&&propType==='apt' ? document.getElementById('rentType').value : '';
  var msg = '⭐ *طلب تمييز إعلان*\n';
  msg += '━━━━━━━━━━━━━━━━━\n';
  msg += '👤 *المعلن:* '  + name + '\n';
  msg += '📞 *الواتساب:* ' + phone + '\n';
  msg += '🏠 *النوع:* '   + (pl[propType]||propType||'—') + ' — ' + (dl[dealType]||'—') + (rentType?' ('+rentType+')':'') + '\n';
  msg += '📍 *المنطقة:* ' + region + '\n';
  if(adPrice) msg += '💰 *السعر:* ' + Number(adPrice).toLocaleString('ar-EG') + ' ج.م\n';
  if(size)    msg += (propType==='apt'?'🛏 *الغرف:* ':'📐 *المساحة:* ') + size + (propType!=='apt'?' م²':'') + '\n';
  if(nearSea) msg += '🌊 *قرب البحر:* ' + nearSea + '\n';
  if(finishVal) msg += '🎨 *التشطيب:* ' + finishVal + '\n';
  if(desc)    msg += '📝 ' + desc + '\n';
  msg += '━━━━━━━━━━━━━━━━━\n';
  msg += '💳 *تم تحويل ' + price + ' ج.م فودافون كاش*\n';
  msg += 'رجاء تمييز الإعلان بالإطار الذهبي ⭐🙏';
  window.open('https://wa.me/'+waNum+'?text='+encodeURIComponent(msg),'_blank');
}

/* ════════ HELPERS ════════ */
/* ════════ CLOSE ALL OVERLAYS ════════ */
/* يُستدعى قبل كل تنقل لضمان عدم تداخل المودالات مع الصفحات */
var _scrollLockCount = 0; // عداد حالات تأمين الـ scroll
function _lockScroll(){
  _scrollLockCount++;
  document.body.style.overflow = 'hidden';
}
function _unlockScroll(){
  _scrollLockCount = Math.max(0, _scrollLockCount - 1);
  if(_scrollLockCount === 0) document.body.style.overflow = '';
}
function _forceUnlockScroll(){
  _scrollLockCount = 0;
  document.body.style.overflow = '';
}

function _closeAllModals(){
  // إغلاق مودال تفاصيل العقار
  var pm = document.getElementById('prop-modal-overlay');
  if(pm && pm.classList.contains('open')){
    pm.classList.remove('open');
    setTimeout(function(){ if(pm) pm.style.display='none'; }, 300);
  }
  // إغلاق مودال إعلانات السمسار
  var bm = document.getElementById('broker-ads-overlay');
  if(bm && bm.classList.contains('open')){
    bm.classList.remove('open');
    setTimeout(function(){ if(bm) bm.style.display='none'; }, 300);
  }
  // إغلاق verify card (داخل s-home — لكن نضمن إغلاقه صراحةً)
  var vc = document.getElementById('verify-card-overlay');
  if(vc) vc.style.display = 'none';
  // فك تأمين الـ scroll بالكامل
  _forceUnlockScroll();
}

function go(id){
  // إغلاق أي مودال مفتوح قبل التنقل لمنع التداخل
  _closeAllModals();
  // صفحات تحتاج تسجيل دخول
  var authRequired=['add','myads','favs','register'];
  if(authRequired.indexOf(id)!==-1 && !currentUser){
    toast('⚠️ سجّل دخولك أولاً');
    document.getElementById('otp-overlay').style.display='flex';
    loadSavedPhones();
    return;
  }
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('s-'+id).classList.add('active');
  if(id==='home'){ resetForm(); updateBrokerHomeCard(); updateMyAdsCard(); updateFavsCard(); }
  if(id==='add')  { updateFormFeaturedPrices(); fillAddFormFromProfile(); }
  if(id==='register') loadRegisterForm();
  if(id==='myads') renderMyAds();
  if(id==='favs') renderFavs();
  window.scrollTo({top:0,behavior:'smooth'});
}
function toast(msg){
  var t=document.getElementById('toast-el');
  t.textContent=msg; t.classList.add('show');
  clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),3200);
}
function hide(id){var e=document.getElementById(id);if(e)e.classList.add('hidden');}
function show(id){var e=document.getElementById(id);if(e)e.classList.remove('hidden');}

/* ════════ LISTINGS ════════ */
var _currentListingsCat = '';
var _listingsSource = 'home'; // تتبع الصفحة التي جاء منها المستخدم لتشغيل زر الرجوع الصحيح
async function showListings(cat, source){
  _currentListingsCat = cat;
  _listingsSource = source || 'home';
  go('listings');
  // تحديث زر الرجوع ليعود للصفحة الصحيحة
  var backBtn = document.querySelector('#s-listings .back-btn');
  if(backBtn){
    var srcLabels = {tourist:'المصيف ⛱️', resident:'الإقامة 🏡', home:'الرئيسية 🏠'};
    backBtn.textContent = '← ' + (srcLabels[_listingsSource] || 'رجوع');
    backBtn.onclick = function(){ go(_listingsSource); };
  }
  currentFilter='الكل';
  document.getElementById('listings-title').textContent = getCatLabel(cat);

  var _lg = document.getElementById('listings-grid');

  // ── Stale-While-Revalidate ──
  // لو في cache → اعرضه فوراً بدون skeleton
  if(_dbCache && (Date.now() - _dbCacheTime) < 300000){ // 5 دقايق
    renderListings(cat);
    // حدّث في الخلفية بصمت (لو الـ cache عمره أكتر من 30 ثانية)
    if((Date.now() - _dbCacheTime) > 30000){
      loadDBAsync().then(function(){
        renderListings(cat);
      }).catch(function(){});
    }
    return;
  }

  // مفيش cache → skeleton + fetch
  if(_lg) _lg.innerHTML = buildSkeletonCards(5);
  var _fetchOk = false;
  try{ await loadDBAsync(); _fetchOk = true; } catch(e){ console.warn('showListings fetch error:', e.message); }
  var _db = loadDB();
  var _hasAny = (_db.approved||[]).length > 0 || (_db.pending||[]).length > 0;
  if(!_fetchOk && !_hasAny){
    var _lg2 = document.getElementById('listings-grid');
    if(_lg2) _lg2.innerHTML = '<div class="no-listings"><div class="nl-ico">📡</div>' +
      '<div style="font-weight:700;font-size:16px;color:#1a2744;margin-bottom:8px">تعذّر تحميل الإعلانات</div>' +
      '<div style="font-size:13px;color:#3d4a5c;margin-bottom:16px">تحقق من الاتصال وحاول مرة أخرى</div>' +
      '<button onclick="showListings(\'' + cat + '\',\'' + (_listingsSource||'home') + '\')" style="background:#1a2f5e;color:#fff;border:none;padding:10px 28px;border-radius:50px;font-family:Cairo,sans-serif;font-size:14px;cursor:pointer">🔄 إعادة المحاولة</button></div>';
    return;
  }
  renderListings(cat);
}
function getCatLabel(c){
  return {
    'يومي':'إيجار يومي 📅','أسبوعي':'إيجار أسبوعي 🗓️',
    'شهري (صيفي)':'إيجار شهري صيفي ☀️','شهري (شتوي)':'إيجار شتوي ❄️',
    'سنوي':'إيجار سنوي 🏡','تمليك':'شقق تمليك 🔑',
    'أرض':'أراضي 🌍','محل':'محلات تجارية 🏪'
  }[c]||c;
}
function renderListings(cat){
  var db=loadDB(); var all=db.approved||[];
  var filtered=all.filter(function(a){
    if(cat==='تمليك') return a.dealType==='sale'&&a.propType==='apt';
    if(cat==='أرض')   return a.propType==='land';
    if(cat==='محل')   return a.propType==='shop';
    return a.rentType===cat;
  });
  _currentListingsData = filtered;
  _priceFilterActive = false;
  currentSort = 'default';
  var sortBtns = document.querySelectorAll('.sort-btn');
  if(sortBtns.length){ sortBtns.forEach(b=>b.classList.remove('on')); sortBtns[0].classList.add('on'); }
  var clearBtn=document.getElementById('price-filter-clear');
  if(clearBtn) clearBtn.style.display='none';
  var _lc=document.getElementById('listings-count'); if(_lc) _lc.textContent=filtered.length?filtered.length+' إعلان متاح':'';
  var filEl=document.getElementById('listings-filters');
  filEl.innerHTML='';
  var regions=['الكل'].concat([...new Set(filtered.map(a=>a.region))]);
  regions.forEach(function(r){
    var b=document.createElement('button');
    b.className='filter-btn'+(r===currentFilter?' on':'');
    b.textContent=r;
    b.onclick=function(){
      currentFilter=r;
      document.querySelectorAll('.filter-btn').forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      renderCards(filtered,r);
    };
    filEl.appendChild(b);
  });
  renderCards(filtered,'الكل');
}
function setSort(type, btn){
  currentSort = type;
  document.querySelectorAll('.sort-btn').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  renderCards(_currentListingsData, currentFilter);
}

function renderCards(ads,regionFilter){
  var shown=regionFilter==='الكل'?ads:ads.filter(a=>a.region===regionFilter);
  // ترتيب
  shown = shown.slice();
  if(currentSort==='default'){
    shown.sort(function(a,b){return (b.featured?1:0)-(a.featured?1:0);});
  } else if(currentSort==='new'){
    shown.sort(function(a,b){
      var ta=a.submitted_ts ? new Date(a.submitted_ts).getTime() : 0;
      var tb=b.submitted_ts ? new Date(b.submitted_ts).getTime() : 0;
      return tb-ta;
    });
  } else if(currentSort==='cheap'){
    shown.sort(function(a,b){return Number(a.price)-Number(b.price);});
  } else if(currentSort==='expensive'){
    shown.sort(function(a,b){return Number(b.price)-Number(a.price);});
  }
  var grid=document.getElementById('listings-grid');
  if(!shown.length){
    grid.innerHTML='<div class="no-listings"><div class="nl-ico">🔍</div><div style="font-weight:700;font-size:16px;color:#1a2744;margin-bottom:8px">لا توجد إعلانات في هذه الفئة حالياً</div><div style="font-size:13px;color:#3d4a5c">كن أول من يضيف إعلان!</div></div>';
    return;
  }
  // Virtual scroll — render first 25, load more on scroll
  _vsAllAds = shown;
  _vsPage = 0;
  renderVirtualBatch(grid, true);
}

function buildAdCards(ads){
  var pe={apt:'🏠',land:'🌍',shop:'🏪'};
  return ads.map(function(a){
    var isFeatured = !!a.featured;
    var favActive = isFav(a.id);
    var isNew = false;
    try{ var t=new Date(a.submitted_ts||a.submittedAt); isNew=(Date.now()-t.getTime())<48*3600*1000 && !isNaN(t.getTime()); }catch(e){}
    var pLabel={apt:'شقة / بيت',land:'أرض',shop:'محل'}[a.propType]||'عقار';
    var safeOwnerName = escapeHTML(a.ownerName);
    var safeRegion    = escapeHTML(a.region);
    var tags=[];
    if(a.size) tags.push(a.propType==='apt'?'🛏 '+escapeHTML(a.size)+' غرف':'📐 '+escapeHTML(a.size)+' م²');
    if(a.aptArea) tags.push('📐 '+escapeHTML(a.aptArea)+' م²');
    if(a.nearSea) tags.push('🌊 '+escapeHTML(a.nearSea));
    if(a.floor&&a.floor!=='') tags.push('🏢 دور '+escapeHTML(a.floor));
    if(a.finishVal) tags.push('🎨 '+escapeHTML(a.finishVal));
    if(a.aptFurnish) tags.push('🛋 '+escapeHTML(a.aptFurnish));
    var dealBdg=a.dealType==='sale'
      ?'<span class="nc-badge nc-sale">تمليك</span>'
      :'<span class="nc-badge nc-rent">'+(a.rentType||'إيجار')+'</span>';
    var topBadges=(isFeatured?'<span class="nc-badge nc-feat">⭐ مميز</span>':'')+(isNew?'<span class="nc-badge nc-new">✨ جديد</span>':'');
    var imgSrc=a.photos&&a.photos.length
      ?'<img src="'+a.photos[0]+'" alt="صورة" style="width:100%;height:100%;object-fit:cover">'
      :'<span style="font-size:62px">'+(pe[a.propType]||'🏠')+'</span>';
    var viewCount = getViews(a.id);
    var aid=a.id, aphone=a.phone;
    // Broker info row
    var brokerHtml='';
    if(a.ownerName){
      var bAvatar = a.brokerPhoto
        ?'<img src="'+escapeHTML(a.brokerPhoto)+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
        :(a.brokerType==='سمسار'?'🤝':'🏠');
      brokerHtml='<div style="display:flex;align-items:center;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid #f0ece0">'+
        '<div style="width:28px;height:28px;border-radius:50%;background:#e8e2d4;display:flex;align-items:center;justify-content:center;font-size:14px;overflow:hidden;flex-shrink:0">'+bAvatar+'</div>'+
        '<div style="font-size:11px;color:#3d4a5c;font-weight:700">'+safeOwnerName+(a.brokerType?' · '+escapeHTML(a.brokerType):'')+'</div>'+
      '</div>';
    }
    var html='<div class="nc-card'+(isFeatured?' nc-featured':'')+'" id="card-'+aid+'" onclick="openPropModal(\''+aid+'\')">';
    html+='<div class="nc-img">'+imgSrc;
    html+='<div class="nc-img-top">';
    html+='<div class="nc-badges">'+dealBdg+topBadges+'</div>';
    html+='<button class="nc-fav'+(favActive?' on':'')+'" id="fav-'+aid+'" onclick="toggleFav(\''+aid+'\',event)">'+(favActive?'❤️':'🤍')+'</button>';
    html+='</div>';
    html+='<div class="nc-over">';
    html+='<div class="nc-title">'+pLabel+' في '+safeRegion+'</div>';
    html+='<div class="nc-loc">📍 '+safeRegion+' · مطروح</div>';
    html+='</div></div>';
    html+='<div class="nc-body"><div style="flex:1">';
    html+='<div class="nc-price">'+Number(a.price).toLocaleString('ar-EG')+' <small>ج.م</small></div>';
    if(a.adCode) html+='<div style="font-size:10px;color:#8a9ab8;font-weight:700;margin-top:2px">#'+a.adCode+'</div>';
    if(tags.length) html+='<div class="nc-tags" style="margin-top:6px">'+tags.map(function(t){return'<span class="nc-tag">'+t+'</span>';}).join('')+'</div>';
    if(viewCount>0) html+='<div style="font-size:10px;color:#8a9ab8;margin-top:5px">👁️ '+viewCount+' مشاهدة</div>';
    html+=brokerHtml;
    html+='</div>';
    html+='<div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">';
    html+='<button class="nc-wa" onclick="contactOwner(\''+aphone+'\',\''+aid+'\',event)" style="width:auto;padding:10px 13px;display:flex;align-items:center;justify-content:center"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="20" height="20"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg></button>';
    html+='</div>';
    html+='</div></div>';
    return html;
  }).join('');
}
function recordView(id){
  var newCount = incrementViews(id);
  var el = document.querySelector('#card-'+id+' .listing-views');
  if(el) el.textContent = '👁️ '+newCount+' مشاهدة';
  return newCount;
}
function contactOwner(phone,id,event){
  if(event) event.stopPropagation();
  var db=loadDB(); var ad=(db.approved||[]).find(a=>a.id===id);
  if(!ad){toast('⚠️ إعلان غير موجود');return;}
  var clean=phone.replace(/\s/g,'').replace(/^0/,'20');
  var pl={apt:'شقة / بيت',land:'أرض',shop:'محل'};
  var msg='مرحبا 👋\nشفت إعلانك على موقع *ديار* 🏠\n';
  msg+='📌 '+(pl[ad.propType]||'عقار')+' في '+ad.region+'\n';
  msg+='💰 '+Number(ad.price).toLocaleString('ar-EG')+' ج.م\n';
  if(ad.rentType) msg+='🗓️ '+ad.rentType+'\n';
  if(ad.adCode) msg+='🔖 كود الإعلان: #'+ad.adCode+'\n';
  msg+='هل هو متاح؟';
  window.open('https://wa.me/'+clean+'?text='+encodeURIComponent(msg),'_blank');
}
function callOwner(phone,event){
  if(event) event.stopPropagation();
  window.location.href='tel:'+phone;
}
function shareAd(id,event){
  if(event) event.stopPropagation();
  var db=loadDB(); var ad=(db.approved||[]).find(a=>a.id===id);
  if(!ad){toast('⚠️ إعلان غير موجود');return;}
  var pl={apt:'شقة / بيت',land:'أرض',shop:'محل'};
  var txt='🏠 *ديار*\n';
  txt+=''+(pl[ad.propType]||'عقار')+' في '+ad.region+'\n';
  txt+='💰 '+Number(ad.price).toLocaleString('ar-EG')+' ج.م\n';
  if(ad.rentType) txt+='🗓️ '+ad.rentType+'\n';
  if(ad.adCode) txt+='🔖 #'+ad.adCode+'\n';
  txt+='\nتواصل مع المعلن: 📞 '+ad.phone;
  if(navigator.share){
    navigator.share({title:'ديار',text:txt}).catch(()=>{});
  } else {
    navigator.clipboard.writeText(txt).then(()=>toast('✅ تم نسخ تفاصيل الإعلان')).catch(()=>{
      var waNum=(loadSettings().adminWa||ADMIN_NUMBER).replace(/^0/,'20');
      window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank');
    });
  }
}

/* ════════ IMAGE SLIDER ════════ */
var _sliderIdx = {};
function sliderMove(id, dir, event){
  if(event) event.stopPropagation();
  var inner=document.getElementById('slider-inner-'+id);
  if(!inner) return;
  var total=inner.children.length;
  _sliderIdx[id]=(_sliderIdx[id]||0);
  _sliderIdx[id]=(_sliderIdx[id]+dir+total)%total;
  sliderApply(id,total);
}
function sliderGo(id, idx, event){
  if(event) event.stopPropagation();
  var inner=document.getElementById('slider-inner-'+id);
  if(!inner) return;
  _sliderIdx[id]=idx;
  sliderApply(id,inner.children.length);
}
function sliderApply(id,total){
  var inner=document.getElementById('slider-inner-'+id);
  var ctr=document.getElementById('slider-ctr-'+id);
  var slider=document.getElementById('slider-'+id);
  if(!inner) return;
  inner.style.transform='translateX('+((_sliderIdx[id]||0)*100)+'%)';
  if(ctr) ctr.textContent=(_sliderIdx[id]+1)+' / '+total;
  if(slider){
    slider.querySelectorAll('.img-slider-dot').forEach(function(d,i){
      d.classList.toggle('active',i===_sliderIdx[id]);
    });
  }
}

/* ════════ PRICE FILTER ════════ */
var _priceFilterActive = false;
var _currentListingsData = [];
function applyPriceFilter(){
  var mn=parseFloat(document.getElementById('price-min').value)||0;
  var mx=parseFloat(document.getElementById('price-max').value)||Infinity;
  if(mn>mx){toast('⚠️ السعر الأدنى أكبر من الأقصى');return;}
  _priceFilterActive=true;
  var clearBtn=document.getElementById('price-filter-clear');
  if(clearBtn) clearBtn.style.display='block';
  var toShow=_currentListingsData.filter(function(a){
    var p=Number(a.price||0);
    return p>=mn && p<=mx;
  });
  toShow=toShow.filter(a=>currentFilter==='الكل'||a.region===currentFilter);
  toShow=toShow.slice().sort(function(a,b){return (b.featured?1:0)-(a.featured?1:0);});
  var grid=document.getElementById('listings-grid');
  var _lc=document.getElementById('listings-count'); if(_lc) _lc.textContent=toShow.length+' إعلان متاح';
  if(!toShow.length){
    grid.innerHTML='<div class="no-listings"><div class="nl-ico">🔍</div><div style="font-weight:700;font-size:16px;color:#1a2744;margin-bottom:8px">لا توجد إعلانات بهذا النطاق السعري</div><button onclick="clearPriceFilter()" style="background:linear-gradient(135deg,#023e8a,#0077b6);color:white;border:none;padding:12px 24px;border-radius:12px;font-family:Cairo,sans-serif;font-weight:700;cursor:pointer;font-size:14px;margin-top:10px">✕ مسح الفلتر</button></div>';
    return;
  }
  grid.innerHTML=buildAdCards(toShow);
}
function clearPriceFilter(){
  _priceFilterActive=false;
  document.getElementById('price-min').value='';
  document.getElementById('price-max').value='';
  var clearBtn=document.getElementById('price-filter-clear');
  if(clearBtn) clearBtn.style.display='none';
  renderCards(_currentListingsData,currentFilter);
  var _lc=document.getElementById('listings-count'); if(_lc) _lc.textContent=_currentListingsData.length+' إعلان متاح';
}

/* ════════ FORM ════════ */
function selectProp(val){
  propType=val; dealType=''; selectedChips={}; nearSea=''; finishVal='';
  ['apt','land','shop'].forEach(v=>document.getElementById('btn-'+v).classList.toggle('on',v===val));
  ['sale','rent'].forEach(v=>document.getElementById('btn-'+v).classList.remove('on'));
  ['rest-form','rent-box','svc-box','finish-box','land-note','shop-deal-sec','deal-sec','svc-summary','finish-summary','shop-payment-row','apt-sale-extras','apt-area-wrap'].forEach(id=>hide(id));
  document.querySelectorAll('.chip,.sea-btn,.finish-btn').forEach(b=>b.classList.remove('on'));
  // reset shop payment btns
  ['btn-shop-sale','btn-shop-rent','btn-pay-cash','btn-pay-install'].forEach(function(id){var b=document.getElementById(id);if(b)b.classList.remove('on');});
  if(val==='land'){show('land-note');dealType='sale';showRest();}
  else if(val==='shop'){show('shop-deal-sec');}
  else show('deal-sec');
  var sl=document.getElementById('size-lbl'),si=document.getElementById('size');
  if(val==='apt'){sl.textContent='عدد الغرف';si.placeholder='3';}
  else{sl.textContent='المساحة (م²)';si.placeholder='200';}
  document.getElementById('price-lbl').textContent=val==='shop'?'السعر (ج.م)':'السعر (ج.م)';
  var d=document.getElementById('desc');
  d.placeholder=val==='apt'?'مثلاً: شقة بإطلالة بحرية، دور ثالث...':val==='land'?'مثلاً: أرض في موقع مميز...':'مثلاً: محل في موقع حيوي، واجهة زجاجية...';
}

function selectShopDeal(val){
  dealType=val;
  ['btn-shop-sale','btn-shop-rent'].forEach(function(id){var b=document.getElementById(id);if(b)b.classList.toggle('on',id==='btn-shop-'+val);});
  ['shop-payment-row','svc-box','finish-box','svc-summary','finish-summary'].forEach(id=>hide(id));
  document.querySelectorAll('.chip,.finish-btn').forEach(b=>b.classList.remove('on'));
  selectedChips={}; finishVal='';
  if(val==='sale'){
    show('shop-payment-row');
    // لا خدمات ولا تشطيب للمحلات تمليك
  }
  document.getElementById('price-lbl').textContent = val==='sale' ? 'سعر التمليك (ج.م)' : 'الإيجار السنوي (ج.م)';
  showRest();
}

var shopPayment = '';
function selectShopPayment(val){
  shopPayment = val;
  ['btn-pay-cash','btn-pay-install'].forEach(function(id){
    var b=document.getElementById(id);
    if(b) b.classList.toggle('on', (val==='كاش'&&id==='btn-pay-cash')||(val==='أقساط'&&id==='btn-pay-install'));
  });
}
function selectDeal(val){
  dealType=val;
  ['sale','rent'].forEach(v=>document.getElementById('btn-'+v).classList.toggle('on',v===val));
  ['svc-box','finish-box','rent-box','svc-summary','finish-summary','apt-sale-extras','apt-area-wrap'].forEach(id=>hide(id));
  document.querySelectorAll('.chip,.finish-btn').forEach(b=>b.classList.remove('on'));
  selectedChips={}; finishVal=''; aptFurnish=''; aptPayment='';
  ['btn-furn-yes','btn-furn-no','btn-apt-cash','btn-apt-install'].forEach(function(id){var b=document.getElementById(id);if(b)b.classList.remove('on');});
  if(val==='rent') show('rent-box');
  if(val==='sale'&&propType==='apt'){
    show('svc-box'); show('finish-box'); show('apt-sale-extras'); show('apt-area-wrap');
    // عند تمليك: اعرض chips المخصصة للتمليك
    var rc=document.getElementById('svc-chips-rent');
    var sc=document.getElementById('svc-chips-sale');
    if(rc) rc.style.display='none';
    if(sc) sc.style.display='flex'; if(sc) sc.style.flexWrap='wrap'; if(sc) sc.style.gap='8px';
  } else {
    // عند الإيجار: اعرض كل الخدمات
    var rc2=document.getElementById('svc-chips-rent');
    var sc2=document.getElementById('svc-chips-sale');
    if(rc2) rc2.style.display='flex'; if(rc2) rc2.style.flexWrap='wrap'; if(rc2) rc2.style.gap='8px';
    if(sc2) sc2.style.display='none';
  }
  showRest();
}
function onRentTypeChange(){
  var rt=document.getElementById('rentType').value;
  ['svc-box','finish-box','svc-summary','finish-summary'].forEach(id=>hide(id));
  document.querySelectorAll('.chip,.finish-btn').forEach(b=>b.classList.remove('on'));
  selectedChips={}; finishVal='';
  if(propType==='apt'&&(rt==='شهري (شتوي)'||rt==='سنوي')){show('svc-box');show('finish-box');}
  var sr=document.getElementById('sea-row');
  if(rt==='يومي'||rt==='أسبوعي'||rt==='شهري (صيفي)'){sr.classList.remove('hidden');}
  else{sr.classList.add('hidden');document.querySelectorAll('.sea-btn').forEach(b=>b.classList.remove('on'));nearSea='';}
  updateStepNumbers();
}
function selectFurnish(val){
  aptFurnish=val;
  document.getElementById('btn-furn-yes').classList.toggle('on',val==='مفروشة');
  document.getElementById('btn-furn-no').classList.toggle('on',val==='غير مفروشة');
}
function selectAptPayment(val){
  aptPayment=val;
  document.getElementById('btn-apt-cash').classList.toggle('on',val==='كاش');
  document.getElementById('btn-apt-install').classList.toggle('on',val==='أقساط');
}
function showRest(){
  show('rest-form');
  document.getElementById('floor-row').classList.toggle('hidden',propType!=='apt');
  document.getElementById('shop-area-row').classList.add('hidden'); // always hidden
  var sr=document.getElementById('sea-row');
  if(propType==='apt'&&dealType==='rent'){
    var rt=document.getElementById('rentType').value;
    sr.classList.toggle('hidden',!(rt==='يومي'||rt==='أسبوعي'||rt==='شهري (صيفي)'));
  } else sr.classList.add('hidden');
  updateStepNumbers();
}
function updateStepNumbers(){
  var hs=!document.getElementById('svc-box').classList.contains('hidden');
  var hf=!document.getElementById('finish-box').classList.contains('hidden');
  var n=3;
  if(hs){document.getElementById('svc-lbl').textContent='③ الخدمات والمرافق المتاحة';n++;}
  if(hf){document.getElementById('finish-lbl').textContent=(hs?'④':'③')+' التشطيب';n++;}
  document.getElementById('region-lbl').textContent=(['①','②','③','④','⑤'][n-1]||n+'.')+' المنطقة في مطروح';
}
function toggleChip(el,id){
  selectedChips[id]=!selectedChips[id]; el.classList.toggle('on',!!selectedChips[id]);
  var lm={water:'مياه',gas:'غاز',elec:'كهرباء',sewage:'صرف صحي',elev:'أسانسير',park:'جراج',sec:'أمن وحراسة',seaview:'إطلالة بحر',furn:'مفروشة',ac:'تكييف',pool:'حمام سباحة',gym:'جيم'};
  var ch=Object.keys(selectedChips).filter(k=>selectedChips[k]).map(k=>lm[k]);
  var s=document.getElementById('svc-summary');
  if(ch.length){s.textContent='✅ '+ch.join(' · ');s.classList.remove('hidden');}else s.classList.add('hidden');
}
function selectFinish(val){
  finishVal=val;
  document.querySelectorAll('.finish-btn').forEach(b=>b.classList.remove('on'));
  document.getElementById({'سوبر لوكس':'fin-super','لوكس':'fin-lux','نص تشطيب':'fin-semi','عظم':'fin-bare'}[val]).classList.add('on');
  var s=document.getElementById('finish-summary');s.textContent='🎨 التشطيب: '+val;s.classList.remove('hidden');
}
function selectSea(el,val){
  nearSea=val;document.querySelectorAll('.sea-btn').forEach(b=>b.classList.remove('on'));el.classList.add('on');
}

/* ════════ PHOTOS ════════ */
function handlePhotos(input){
  var files = Array.from(input.files);
  var maxPhotos = 8;
  if(uploadedPhotos.length + files.length > maxPhotos){
    toast('⚠️ الحد الأقصى ' + maxPhotos + ' صور');
    files = files.slice(0, maxPhotos - uploadedPhotos.length);
  }
  if(!window._uploadedPhotoFiles) window._uploadedPhotoFiles = [];
  files.forEach(function(f){
    // Validate file size (max 10MB)
    if(f.size > 10 * 1024 * 1024){
      toast('❌ الملف كبير جداً (الحد 10 ميجا): ' + f.name);
      return;
    }
    window._uploadedPhotoFiles.push(f);
    var r = new FileReader();
    r.onload = function(e){ uploadedPhotos.push(e.target.result); renderPhotos(); };
    r.readAsDataURL(f);
  });
  input.value = '';
}
function renderPhotos(){
  var prev = document.getElementById('photo-previews');
  var ph = document.getElementById('photo-placeholder');
  if(!prev || !ph) return;
  prev.innerHTML = '';
  if(uploadedPhotos.length){
    ph.style.display = 'none';
    prev.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:100%';
    uploadedPhotos.forEach(function(src, i){
      var w = document.createElement('div');
      w.className = 'photo-thumb-wrap';
      w.style.cssText = 'position:relative;aspect-ratio:1;border-radius:12px;overflow:hidden;';
      w.innerHTML = '<img src="'+src+'" style="width:100%;height:100%;object-fit:cover">'+
        '<button class="photo-del" onclick="removePhoto('+i+')" style="position:absolute;top:4px;right:4px;background:rgba(220,38,38,.85);color:white;border:none;border-radius:50%;width:22px;height:22px;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:700">✕</button>';
      prev.appendChild(w);
    });
    if(uploadedPhotos.length < 8){
      var a = document.createElement('div');
      a.style.cssText = 'aspect-ratio:1;border-radius:12px;border:2px dashed #c9a84c;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;font-size:24px;color:#c9a84c;background:#fdfaf4;gap:4px';
      a.innerHTML = '+<span style="font-size:10px;font-weight:700">إضافة</span>';
      a.onclick = function(){ document.getElementById('photo-input').click(); };
      prev.appendChild(a);
    }
  } else {
    ph.style.display = '';
    prev.style.display = 'none';
  }
}
function removePhoto(i){
  uploadedPhotos.splice(i,1);
  if(window._uploadedPhotoFiles) window._uploadedPhotoFiles.splice(i,1);
  renderPhotos();
}


function buildSkeletonCards(count){
  var html = '<div class="shimmer-wrap">';
  for(var i=0;i<(count||4);i++){
    html += '<div class="sk-card">'+
      '<div class="sk-img skeleton"></div>'+
      '<div class="sk-body">'+
        '<div class="sk-line w80 h16 skeleton"></div>'+
        '<div class="sk-line w60 skeleton"></div>'+
        '<div class="sk-line w40 skeleton"></div>'+
        '<div class="sk-line w100 h20 skeleton" style="margin-top:auto"></div>'+
      '</div>'+
    '</div>';
  }
  html += '</div>';
  return html;
}


/* ════════ VIRTUAL SCROLL ════════ */
function renderVirtualBatch(grid, reset){
  if(!grid) grid = document.getElementById('listings-grid');
  if(!grid) return;
  var start = reset ? 0 : (_vsPage * _vsPageSize);
  var batch = _vsAllAds.slice(start, start + _vsPageSize);
  if(reset){
    grid.innerHTML = buildAdCards(batch);
    _vsPage = 1;
  } else {
    var loadMoreBtn = document.getElementById('vs-load-more');
    if(loadMoreBtn) loadMoreBtn.remove();
    grid.insertAdjacentHTML('beforeend', buildAdCards(batch));
    _vsPage++;
  }
  // Show "load more" button if more ads exist
  var shown = _vsPage * _vsPageSize;
  if(shown < _vsAllAds.length){
    var remaining = _vsAllAds.length - shown;
    var btn = document.createElement('div');
    btn.id = 'vs-load-more';
    btn.style.cssText = 'text-align:center;padding:16px 0;';
    btn.innerHTML = '<button onclick="renderVirtualBatch()" style="background:linear-gradient(135deg,#c9a84c,#e8d08a);color:#0a1628;border:none;padding:12px 32px;border-radius:50px;font-family:Cairo,sans-serif;font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 4px 16px rgba(201,168,76,.3)">عرض '+remaining+' إعلان آخر ↓</button>';
    grid.appendChild(btn);
  }
}
/* ════════ PREVIEW SYSTEM ════════ */
var _pendingAd = null;

function buildAdMsg(ad){
  var pl={apt:'شقة / بيت',land:'أرض',shop:'محل'};
  var dl={sale:'تمليك',rent:'إيجار'};
  var lm={water:'مياه',gas:'غاز',elec:'كهرباء',sewage:'صرف صحي',elev:'أسانسير',park:'جراج',sec:'أمن',seaview:'إطلالة بحر',furn:'مفروشة',ac:'تكييف',pool:'حمام سباحة',gym:'جيم'};
  var msg='🔔 *إعلان جديد ينتظر مراجعتك*\n';
  msg+='━━━━━━━━━━━━━━━━━\n';
  msg+='👤 *المعلن:* '+ad.ownerName+'\n';
  msg+='📌 *النوع:* '+(pl[ad.propType]||ad.propType)+' — '+(dl[ad.dealType]||'')+(ad.rentType?' ('+ad.rentType+')':'')+'\n';
  msg+='📍 *المنطقة:* '+ad.region+'\n';
  msg+='💰 *السعر:* '+Number(ad.price).toLocaleString('ar-EG')+' ج.م\n';
  if(ad.size) msg+=(ad.propType==='apt'?'🛏 *الغرف:* ':'📐 *المساحة:* ')+ad.size+(ad.propType!=='apt'?' م²':'')+'\n';
  if(ad.aptArea) msg+='📐 *المساحة:* '+ad.aptArea+' م²\n';
  if(ad.floor) msg+='🏢 *الدور:* '+ad.floor+'\n';
  if(ad.nearSea) msg+='🌊 *قرب البحر:* '+ad.nearSea+'\n';
  if(ad.finishVal) msg+='🎨 *التشطيب:* '+ad.finishVal+'\n';
  if(ad.aptFurnish) msg+='🛋️ *الفرش:* '+ad.aptFurnish+'\n';
  if(ad.aptPayment) msg+='💳 *الدفع:* '+ad.aptPayment+'\n';
  if(ad.services&&ad.services.length) msg+='✅ *الخدمات:* '+ad.services.map(function(k){return lm[k]||k;}).join(' · ')+'\n';
  if(ad.desc) msg+='📝 '+ad.desc+'\n';
  msg+='━━━━━━━━━━━━━━━━━\n';
  msg+='📞 *واتساب المعلن:* '+ad.phone+'\n';
  msg+='🔗 wa.me/'+ad.phone.replace(/^0/,'20')+'\n';
  msg+='🕐 '+ad.submittedAt+'\n\n';
  msg+='افتح لوحة التحكم للموافقة أو الرفض ✅❌';
  return msg;
}

async function validateForm(){
  var profile=loadBrokerProfile();
  var _onEl=document.getElementById('owner-name');
  var name=profile?profile.name:(_onEl?_onEl.value.trim():'');
  var region=document.getElementById('region').value;
  var price=document.getElementById('price').value;
  var _phEl=document.getElementById('phone');
  var phone=profile?profile.phone:(_phEl?_phEl.value.replace(/\s/g,''):'');
  if(!name){toast('❌ الاسم مطلوب — من فضلك أدخل اسمك الكامل');return null;}
  if(!propType){toast('❌ اختر نوع العقار أولاً (شقة / بيت / أرض / محل)');return null;}
  if(!dealType){toast('❌ اختر نوع المعاملة (بيع / إيجار)');return null;}
  if(!region){toast('❌ اختر المنطقة من القائمة');return null;}
  if(!price || isNaN(Number(price)) || Number(price) <= 0){toast('❌ السعر مطلوب ويجب أن يكون رقمًا أكبر من الصفر');return null;}
  if(!phone){toast('❌ رقم الواتساب مطلوب للتواصل مع المشترين');return null;}
  if(!/^(010|011|012|015)\d{8}$/.test(phone)){toast('⚠️ رقم غير صحيح — يبدأ بـ 010/011/012/015');return null;}
  // الصور اختيارية
  var adCode = await getNextAdCode();
  return {
    id:'ad_'+Date.now()+'_'+Math.random().toString(36).substr(2,6),
    adCode: adCode,
    submitterPhone: currentUser ? currentUser.phone : phone,
    ownerName:name, region, price, phone, propType, dealType,
    rentType:dealType==='rent'&&propType==='apt'?document.getElementById('rentType').value:'',
    shopPayment:propType==='shop'&&dealType==='sale'?shopPayment:'',
    size:document.getElementById('size').value,
    aptArea:propType==='apt'&&dealType==='sale'?(document.getElementById('apt-area')?document.getElementById('apt-area').value:''):'',
    floor:propType==='apt'?document.getElementById('floor').value:'',
    nearSea, finishVal, aptFurnish, aptPayment,
    services:Object.keys(selectedChips).filter(function(k){return selectedChips[k];}),
    desc:document.getElementById('desc').value.trim(),
    photos:[],
    brokerPhoto: profile?profile.photo:'',
    brokerType: profile?profile.accountType:'',
    submittedAt:new Date().toLocaleString('ar-EG'),
    submitted_ts: new Date().toISOString()
  };
}

async function openPreview(){
  var ad = await validateForm();
  if(!ad) return;
  _pendingAd = ad;
  document.getElementById('preview-msg').textContent = buildAdMsg(ad);
  (function(){var _e=document.getElementById('preview-overlay');if(_e)_e.classList.remove('hidden')})();
  window.scrollTo({top:0,behavior:'smooth'});
}

function closePreview(){
  (function(){var _e=document.getElementById('preview-overlay');if(_e)_e.classList.add('hidden')})();
  _pendingAd = null;
}

async function confirmSend(){
  if(!_pendingAd){closePreview();return;}
  var ad = _pendingAd;
  var _bp = loadBrokerProfile();
  ad.submitterPhone = _bp ? (_bp.linkedPhone || _bp.phone) : (currentUser ? currentUser.phone : ad.phone);
  (function(){var _e=document.getElementById('preview-overlay');if(_e)_e.classList.add('hidden')})();
  _pendingAd = null;
  try{
    var photoFiles = window._uploadedPhotoFiles || [];
    if(photoFiles.length > 0){
      showUploadProgress(0, 1, photoFiles.length);
      try{
        var cloudUrls = await uploadAllPhotosToCloudinary(photoFiles, function(pct, cur, total){
          showUploadProgress(pct, cur, total);
        });
        ad.photos = cloudUrls;
      } catch(uploadErr){
        hideUploadProgress();
        toast('❌ ' + (uploadErr.message || 'فشل رفع الصور'));
        return;
      }
      hideUploadProgress();
    }
    ad.updated_at = new Date().toISOString();

    // ── حفظ في Supabase أولاً (ليس fire-and-forget) ──
    var dbOk = false;
    try{
      await _upsertAdSB(ad, 'pending');
      dbOk = true;
    } catch(dbErr){
      console.error('confirmSend DB error:', dbErr.message);
      // أضف للـ cache المحلي على أي حال حتى لا يضيع الإعلان
      (function(){ var _ld=loadDB(); _ld.pending=[ad].concat(_ld.pending||[]); saveDB(_ld); })();
      updateMyAdsCard();
      renderSuccessAdPreview(ad);
      resetForm();
      go('success');
      toast('⚠️ تعذر الحفظ في قاعدة البيانات — ' + dbErr.message);
      toast('💾 الإعلان محفوظ محلياً فقط — راجع اتصالك أو إعدادات Supabase');
      return;
    }

    // ── نجح الحفظ في Supabase ──
    (function(){ var _ld=loadDB(); _ld.pending=[ad].concat(_ld.pending||[]); saveDB(_ld); })();
    _dbCacheTime = 0;
    try{ await loadDBAsync(true); } catch(e){ console.warn('loadDBAsync:', e.message); }
    updateNotifDot();
    updateMyAdsCard();
    showSuccessScreen();
    toast('✅ تم إرسال إعلانك للمراجعة!');
    var _ms=document.getElementById('s-myads'); if(_ms&&_ms.classList.contains('active')) _doRenderMyAds();
    var _ao=document.getElementById('admin-overlay'); if(_ao&&!_ao.classList.contains('hidden')) renderAdminPanel();
  } catch(e){
    console.error('confirmSend error:', e);
    toast('❌ ' + e.message);
  }
}

async function submitAdDirect(){
  try{
    var ad = await validateForm();
    if(!ad) return;

    var photoFiles = window._uploadedPhotoFiles || [];
    if(photoFiles.length > 0){
      showUploadProgress(0, 1, photoFiles.length);
      try{
        var cloudUrls = await uploadAllPhotosToCloudinary(photoFiles, function(pct, cur, total){
          showUploadProgress(pct, cur, total);
        });
        ad.photos = cloudUrls;
      } catch(uploadErr){
        hideUploadProgress();
        toast('❌ ' + (uploadErr.message || 'فشل رفع الصور'));
        return;
      }
      hideUploadProgress();
    }

    var _bp2 = loadBrokerProfile();
    ad.submitterPhone = _bp2 ? (_bp2.linkedPhone || _bp2.phone) : (currentUser ? currentUser.phone : ad.phone);
    ad.updated_at = new Date().toISOString();

    // ── حفظ في Supabase أولاً ──
    try{
      await _upsertAdSB(ad, 'pending');
    } catch(dbErr){
      console.error('submitAdDirect DB error:', dbErr.message);
      // احفظ محلياً حتى لا يضيع الإعلان
      (function(){ var _ld=loadDB(); _ld.pending=[ad].concat(_ld.pending||[]); saveDB(_ld); })();
      updateMyAdsCard();
      renderSuccessAdPreview(ad);
      resetForm();
      go('success');
      toast('⚠️ تعذر الحفظ في قاعدة البيانات — ' + dbErr.message);
      toast('💾 الإعلان محفوظ محلياً — راجع اتصالك أو إعدادات Supabase');
      return;
    }

    // ── نجح الحفظ ──
    (function(){ var _ld=loadDB(); _ld.pending=[ad].concat(_ld.pending||[]); saveDB(_ld); })();
    _dbCacheTime = 0;
    try{ await loadDBAsync(true); } catch(e){ console.warn('loadDBAsync:', e.message); }
    updateNotifDot();
    updateMyAdsCard();
    renderSuccessAdPreview(ad);
    resetForm();
    go('success');
    toast('✅ تم إرسال إعلانك بنجاح!');
    var _ms=document.getElementById('s-myads'); if(_ms&&_ms.classList.contains('active')) _doRenderMyAds();
    var _ao=document.getElementById('admin-overlay'); if(_ao&&!_ao.classList.contains('hidden')) renderAdminPanel();
  } catch(err){
    console.error('submitAdDirect error:', err);
    hideUploadProgress();
    var msg = err.message || 'حدث خطأ غير معروف';
    if(msg.includes('network') || msg.includes('fetch')) msg = 'تحقق من اتصال الإنترنت';
    toast('❌ ' + msg);
  }
}

function showUploadProgress(pct, cur, total){
  var overlay = document.getElementById('upload-progress-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'upload-progress-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(10,22,40,.75);z-index:9999;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = '<div style="background:white;border-radius:20px;padding:32px 28px;width:88%;max-width:340px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3)">' +
      '<div style="font-size:32px;margin-bottom:12px">📤</div>' +
      '<div style="font-size:16px;font-weight:800;color:#0a1628;margin-bottom:6px" id="upload-progress-title">جاري رفع الصور...</div>' +
      '<div style="font-size:13px;color:#3d4a5c;margin-bottom:16px" id="upload-progress-sub">صورة 1 من 1</div>' +
      '<div style="background:#f0f0f0;border-radius:50px;height:10px;overflow:hidden">' +
        '<div id="upload-progress-bar" style="height:100%;background:linear-gradient(90deg,#c9a84c,#e8d08a);border-radius:50px;transition:width .3s;width:0%"></div>' +
      '</div>' +
      '<div id="upload-progress-pct" style="font-size:13px;font-weight:700;color:#c9a84c;margin-top:10px">0%</div>' +
    '</div>';
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
  var bar = document.getElementById('upload-progress-bar');
  var pctEl = document.getElementById('upload-progress-pct');
  var sub = document.getElementById('upload-progress-sub');
  if(bar) bar.style.width = pct + '%';
  if(pctEl) pctEl.textContent = pct + '%';
  if(sub && total > 1) sub.textContent = 'صورة ' + cur + ' من ' + total;
}

function hideUploadProgress(){
  var overlay = document.getElementById('upload-progress-overlay');
  if(overlay) overlay.style.display = 'none';
  window._uploadedPhotoFiles = [];
}

function renderSuccessAdPreview(ad){
  var pl={apt:'شقة / بيت',land:'أرض',shop:'محل'};
  var pe={apt:'🏠',land:'🌍',shop:'🏪'};
  var imgHtml = ad.photos && ad.photos.length
    ? '<div class="listing-img-box" style="height:140px"><img src="'+ad.photos[0]+'" style="width:100%;height:100%;object-fit:cover"></div>'
    : '<div class="listing-img-box" style="height:90px;font-size:44px">'+(pe[ad.propType]||'🏠')+'</div>';

  document.getElementById('success-ad-preview').innerHTML =
    '<div style="font-weight:800;font-size:14px;color:#3d4a5c;margin-bottom:10px;padding:0 4px">📋 إعلانك:</div>'+
    '<div class="my-ad-card pending-ad">'+
      imgHtml+
      '<div class="listing-body">'+
        '<span class="my-ad-status status-pending">⏳ قيد المراجعة</span>'+
        '<div class="listing-title">'+(pl[ad.propType]||'عقار')+' في '+ad.region+'</div>'+
        '<div class="listing-loc">📍 '+ad.region+' · 🕐 '+ad.submittedAt+'</div>'+
        '<div class="listing-price">'+Number(ad.price).toLocaleString('ar-EG')+' <span>ج.م</span></div>'+
      '</div>'+
      '<div class="my-ad-actions" style="grid-template-columns:1fr">'+
        '<button class="mya-btn mya-del" style="width:100%" onclick="deletePendingFromSuccess(\''+ad.id+'\')"><span class="mico">🗑️</span>حذف الإعلان</button>'+
      '</div>'+
    '</div>';
}

function deletePendingFromSuccess(id){
  if(!confirm('هل تريد حذف هذا الإعلان؟')) return;
  var db=loadDB();
  db.pending=(db.pending||[]).filter(a=>a.id!==id);
  saveDB(db);
  deleteAdFromSB(id).catch(function(e){ console.error('deletePendingFromSuccess SB error:', e.message); });
  updateNotifDot(); updateMyAdsCard();
  document.getElementById('success-ad-preview').innerHTML='<div class="empty-myads" style="padding:20px"><div class="eico" style="font-size:40px">🗑️</div><div style="font-size:14px;font-weight:700;color:#3d4a5c">تم حذف الإعلان</div></div>';
  toast('🗑️ تم حذف الإعلان');
}

function updatePriceHint(){
  var v=document.getElementById('price').value;
  var el=document.getElementById('price-hint');
  if(!el)return;
  el.textContent = (v&&Number(v)>0) ? '💰 '+Number(v).toLocaleString('ar-EG')+' ج.م' : '';
}

/* ════════ SUBMIT ════════ */
function showSuccessScreen(){
  resetForm();
  go('success');
}
function submitForm(){ openPreview().catch(function(e){ console.error('submitForm error:', e.message); }); }

/* ════════ ADMIN ════════ */
var tapCount=0, tapTimer;
document.getElementById('header-tap').addEventListener('click',function(){
  if(!currentUser || !currentUser.isAdmin) return; // فقط للأدمن
  tapCount++;clearTimeout(tapTimer);
  tapTimer=setTimeout(()=>tapCount=0,1500);
  if(tapCount>=5){
    tapCount=0;
    var _fabEl=document.getElementById('admin-fab'); if(_fabEl) _fabEl.style.display='flex';
    openAdmin();
  }
});

function updateNotifDot(){
  var db=loadDB(); var n=(db.pending||[]).length;
  var dot=document.getElementById('notif-dot');
  if(!dot) return;
  if(n>0){dot.textContent=n;dot.classList.remove('hidden');}
  else dot.classList.add('hidden');
}

async function openAdmin(){
  // أغلق أي مودال مفتوح قبل فتح الأدمن لمنع التداخل (z-index 300 < 600)
  _closeAllModals();
  show('admin-overlay');
  if(currentUser && currentUser.isAdmin){
    hide('admin-login-sec'); show('admin-content');
    document.querySelectorAll('.atab').forEach(b=>b.classList.remove('on'));
    document.querySelectorAll('.atab')[0].classList.add('on');
    document.querySelectorAll('.admin-tab-content').forEach(c=>c.classList.remove('active'));
    document.getElementById('atab-ads').classList.add('active');
    // جيب أحدث البيانات من Supabase دايماً (forceRefresh)
    toast('⏳ جاري تحديث البيانات...');
    try{
      await Promise.all([loadDBAsync(true), loadUsersAsync(), loadSettingsAsync()]);
    } catch(e){}
    renderAdminPanel();
  } else {
    hide('admin-content'); show('admin-login-sec');
    document.getElementById('admin-pass').value='';
    setTimeout(()=>document.getElementById('admin-pass').focus(),200);
  }
  var _afab = document.getElementById('admin-fab');
  if(_afab) _afab.style.display='flex';
  _lockScroll();
}
function closeAdmin(){
  hide('admin-overlay');
  hide('admin-content'); show('admin-login-sec');
  _forceUnlockScroll();
}
function adminLogin(){
  var entered = document.getElementById('admin-pass').value;
  var s = loadSettings();
  var storedPass = s.adminPass || ADMIN_PASS; // fallback للكلمة الافتراضية لو مفيش في DB
  if(entered === storedPass){
    hide('admin-login-sec'); show('admin-content');
    document.querySelectorAll('.atab').forEach(b=>b.classList.remove('on'));
    document.querySelectorAll('.atab')[0].classList.add('on');
    document.querySelectorAll('.admin-tab-content').forEach(c=>c.classList.remove('active'));
    document.getElementById('atab-ads').classList.add('active');
    renderAdminPanel();
  } else {
    toast('⚠️ كلمة السر غلط');
    document.getElementById('admin-pass').value='';
    document.getElementById('admin-pass').focus();
  }
}

async function switchAdminTab(tab, btn){
  document.querySelectorAll('.atab').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  document.querySelectorAll('.admin-tab-content').forEach(c=>c.classList.remove('active'));
  document.getElementById('atab-'+tab).classList.add('active');
  // جيب أحدث البيانات من Supabase دايماً (forceRefresh)
  try{
    await Promise.all([loadDBAsync(true), loadUsersAsync()]);
  } catch(e){}
  if(tab==='ads') renderAdminPanel();
  if(tab==='featured') renderFeaturedTab();
  if(tab==='users') renderUsersPanel();
  if(tab==='brokers') renderBrokersPanel();
  if(tab==='stats') renderStatsPanel();
  if(tab==='settings') renderSettingsPanel();
}

function updateAdminStats(){
  var db=loadDB(); var users=loadUsers();
  var approved=db.approved||[];
  document.getElementById('stat-pending').textContent = (db.pending||[]).length;
  document.getElementById('stat-approved').textContent = approved.length;
  document.getElementById('stat-featured').textContent = approved.filter(a=>a.featured).length;
  document.getElementById('stat-users').textContent = users.length;
}

function renderAdminPanel(){
  updateAdminStats();
  var db=loadDB();
  var pl={apt:'شقة / بيت',land:'أرض',shop:'محل'};
  var plist=document.getElementById('pending-list');

  if(!db.pending||!db.pending.length){
    plist.innerHTML='<div class="empty-admin">✅ لا توجد إعلانات في الانتظار</div>';
  } else {
    plist.innerHTML='<div class="sec-header"><div class="sec-header-title">⏳ قيد المراجعة <span class="sec-badge sec-badge-red">'+db.pending.length+'</span></div></div>'+
      db.pending.map(function(a){
        var thumbs=a.photos&&a.photos.length
          ?'<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">'+a.photos.slice(0,4).map(p=>'<img src="'+p+'" style="width:68px;height:68px;border-radius:10px;object-fit:cover;border:2px solid #e8f0f8">').join('')+'</div>':'';
        return '<div class="pending-card">'+
          '<div class="pending-info">'+(pl[a.propType]||a.propType)+' — '+(a.dealType==='sale'?'تمليك':'إيجار')+(a.rentType?' ('+a.rentType+')':'')+' · '+a.region+'</div>'+
          '<div class="pending-sub">👤 <b>'+a.ownerName+'</b><br>📞 '+a.phone+' <button class="copy-phone-btn" onclick="copyPhone(\''+a.phone+'\')">📋 نسخ</button><br>💰 '+Number(a.price).toLocaleString('ar-EG')+' ج.م'+(a.size?' · '+(a.propType==='apt'?a.size+' غرف':a.size+' م²'):'')+
          (a.nearSea?'<br>🌊 '+a.nearSea:'')+(a.finishVal?'<br>🎨 '+a.finishVal:'')+'<br>🕐 '+a.submittedAt+'</div>'+
          thumbs+
          (a.desc?'<div style="font-size:12px;color:#3d4a5c;background:#f0f7ff;padding:10px 14px;border-radius:12px;margin-bottom:10px;line-height:1.7">'+escapeHTML(a.desc)+'</div>':'')+
          '<div class="pending-actions">'+
            '<button class="btn-approve" onclick="approveAd(\''+a.id+'\')">✅ نشر الإعلان</button>'+
            '<button class="btn-reject" onclick="rejectAd(\''+a.id+'\')">❌ رفض</button>'+
          '</div></div>';
      }).join('');
  }

  var asec=document.getElementById('approved-section');
  var approved=db.approved||[];
  if(approved.length){
    asec.innerHTML='<div class="sec-header" style="margin-top:20px"><div class="sec-header-title">✅ منشورة <span class="sec-badge sec-badge-green">'+approved.length+'</span></div></div>'+
      approved.map(function(a){
        var isFeatured=!!a.featured;
        var imgEl=a.photos&&a.photos.length
          ?'<img class="approved-card-img" src="'+a.photos[0]+'" style="object-fit:cover">'
          :'<div class="approved-card-img">'+(({apt:'🏠',land:'🌍',shop:'🏪'})[a.propType]||'🏠')+'</div>';
        return '<div class="approved-card'+(isFeatured?' is-featured':'')+'">'+imgEl+
          '<div class="approved-card-info">'+
            '<div class="approved-card-title">'+(isFeatured?'⭐ ':'')+( pl[a.propType]||'عقار')+' · '+a.region+'</div>'+
            '<div class="approved-card-sub">👤 '+a.ownerName+' · 📞 '+a.phone+'</div>'+
            '<div class="approved-card-price">'+Number(a.price).toLocaleString('ar-EG')+' ج.م</div>'+
          '</div>'+
          '<div class="approved-card-actions">'+
            '<button class="ac-btn ac-star'+(isFeatured?' on':'')+'" onclick="toggleFeaturedAd(\''+a.id+'\')" title="'+(isFeatured?'إلغاء التمييز':'تمييز')+'">⭐</button>'+
            '<button class="ac-btn ac-del" onclick="deleteAd(\''+a.id+'\')" title="حذف">🗑️</button>'+
          '</div>'+
        '</div>';
      }).join('');
  } else {
    asec.innerHTML='';
  }
}

function renderFeaturedTab(){
  var db=loadDB();
  var pl={apt:'شقة / بيت',land:'أرض',shop:'محل'};
  var featured=(db.approved||[]).filter(a=>a.featured);
  var el=document.getElementById('featured-list');
  if(!featured.length){
    el.innerHTML='<div class="empty-admin">⭐ لا توجد إعلانات مميزة حالياً</div>';return;
  }
  el.innerHTML='<div class="sec-header"><div class="sec-header-title">⭐ الإعلانات المميزة <span class="sec-badge sec-badge-gold">'+featured.length+'</span></div></div>'+
    featured.map(function(a){
      var imgEl=a.photos&&a.photos.length
        ?'<img class="approved-card-img" src="'+a.photos[0]+'" style="object-fit:cover">'
        :'<div class="approved-card-img">'+(({apt:'🏠',land:'🌍',shop:'🏪'})[a.propType]||'🏠')+'</div>';
      return '<div class="approved-card is-featured">'+imgEl+
        '<div class="approved-card-info">'+
          '<div class="approved-card-title">⭐ '+(pl[a.propType]||'عقار')+' · '+a.region+'</div>'+
          '<div class="approved-card-sub">👤 '+a.ownerName+'</div>'+
          '<div class="approved-card-price">'+Number(a.price).toLocaleString('ar-EG')+' ج.م</div>'+
        '</div>'+
        '<div class="approved-card-actions">'+
          '<button class="ac-btn ac-star on" onclick="toggleFeaturedAd(\''+a.id+'\')" title="إلغاء التمييز">⭐</button>'+
          '<button class="ac-btn ac-del" onclick="deleteAd(\''+a.id+'\')" title="حذف">🗑️</button>'+
        '</div>'+
      '</div>';
    }).join('');
}

function renderStatsPanel(){
  var db=loadDB(); var users=loadUsers();
  var approved=db.approved||[];
  var pending=db.pending||[];
  var featured=approved.filter(a=>a.featured);
  // By type
  var byType={apt:0,land:0,shop:0};
  approved.forEach(a=>byType[a.propType]=(byType[a.propType]||0)+1);
  // By region
  var byRegion={};
  approved.forEach(a=>{byRegion[a.region]=(byRegion[a.region]||0)+1;});
  var regionRows=Object.entries(byRegion).sort((a,b)=>b[1]-a[1]).slice(0,6);
  var totalPrice=approved.reduce((s,a)=>s+Number(a.price||0),0);
  var avgPrice=approved.length?Math.round(totalPrice/approved.length):0;

  document.getElementById('stats-content').innerHTML=
    '<div class="settings-section">'+
      '<div class="settings-section-title">📊 نظرة عامة</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'+
        statCard('📋','إجمالي الإعلانات',approved.length+pending.length,'#023e8a')+
        statCard('✅','منشورة',approved.length,'#0a7a4a')+
        statCard('⏳','قيد المراجعة',pending.length,'#92400e')+
        statCard('⭐','مميزة',featured.length,'#b45309')+
        statCard('👥','المستخدمون',users.length,'#5b21b6')+
        statCard('💰','متوسط السعر',avgPrice.toLocaleString('ar-EG')+' ج.م','#0077b6')+
      '</div>'+
    '</div>'+
    '<div class="settings-section">'+
      '<div class="settings-section-title">🏠 الإعلانات حسب النوع</div>'+
      typeBar('🏠 شقق',byType.apt||0,approved.length,'#0077b6')+
      typeBar('🌍 أراضي',byType.land||0,approved.length,'#16a34a')+
      typeBar('🏪 محلات',byType.shop||0,approved.length,'#7c3aed')+
    '</div>'+
    (regionRows.length?'<div class="settings-section">'+
      '<div class="settings-section-title">📍 أكثر المناطق إعلانات</div>'+
      regionRows.map(function(r){return typeBar(r[0],r[1],approved.length,'#0077b6');}).join('')+
    '</div>':'');
}

function statCard(ico,lbl,val,color){
  return '<div style="background:linear-gradient(135deg,'+color+'18,'+color+'08);border:2px solid '+color+'22;border-radius:14px;padding:14px;text-align:center">'+
    '<div style="font-size:22px">'+ico+'</div>'+
    '<div style="font-size:20px;font-weight:900;color:'+color+';margin:4px 0">'+val+'</div>'+
    '<div style="font-size:11px;color:#3d4a5c;font-weight:700">'+lbl+'</div>'+
  '</div>';
}
function typeBar(lbl,val,total,color){
  var pct=total?Math.round(val/total*100):0;
  return '<div style="margin-bottom:12px">'+
    '<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;margin-bottom:5px">'+
      '<span>'+lbl+'</span><span style="color:'+color+'">'+val+' ('+pct+'%)</span>'+
    '</div>'+
    '<div style="background:#f0f7ff;border-radius:50px;height:10px;overflow:hidden">'+
      '<div style="background:'+color+';width:'+pct+'%;height:100%;border-radius:50px;transition:width .4s"></div>'+
    '</div>'+
  '</div>';
}

function toggleFeaturedAd(id){
  var db=loadDB();
  var ad=(db.approved||[]).find(a=>a.id===id);
  if(!ad){toast('⚠️ إعلان غير موجود');return;}
  ad.featured=!ad.featured;
  saveDB(db); updateAdminStats();
  saveAdToSB(ad, 'approved').catch(function(e){ console.error('toggleFeaturedAd SB error:', e.message); });
  // refresh whichever tab is active
  var activeTab=document.querySelector('.admin-tab-content.active');
  if(activeTab){
    var tabId=activeTab.id.replace('atab-','');
    if(tabId==='ads') renderAdminPanel();
    else if(tabId==='featured') renderFeaturedTab();
  }
  toast(ad.featured?'⭐ تم تمييز الإعلان بالإطار الذهبي':'☆ تم إلغاء تمييز الإعلان');
}

function renderUsersPanel(){
  var users=loadUsers();
  var db=loadDB();
  var el=document.getElementById('users-list');
  if(!users.length){el.innerHTML='<div class="empty-admin">👥 لا يوجد مستخدمون مسجلون بعد</div>';return;}
  el.innerHTML='<div class="sec-header"><div class="sec-header-title">👥 المستخدمون <span class="sec-badge sec-badge-green">'+users.length+'</span></div></div>'+
    users.map(function(u){
      var isBlocked=!!u.blocked;
      var myAds=(db.approved||[]).filter(a=>a.phone===u.phone||a.submitterPhone===u.phone).length;
      var myPending=(db.pending||[]).filter(a=>a.phone===u.phone||a.submitterPhone===u.phone).length;
      return '<div class="user-row">'+
        '<div class="user-avatar">'+(isBlocked?'🚫':'👤')+'</div>'+
        '<div class="user-info">'+
          '<div class="user-name">'+u.phone+'</div>'+
          '<div class="user-phone">انضم: '+u.joinedAt+'</div>'+
          '<div class="user-phone" style="margin-top:2px">📋 '+myAds+' منشور · ⏳ '+myPending+' انتظار</div>'+
          '<div class="user-status '+(isBlocked?'blocked':'active')+'">'+(isBlocked?'🚫 محظور':'✅ نشط')+'</div>'+
        '</div>'+
        '<button class="btn-block '+(isBlocked?'unblock':'block')+'" onclick="toggleBlockUser(\''+u.phone+'\')">'+(isBlocked?'✅ رفع حظر':'🚫 حظر')+'</button>'+
      '</div>';
    }).join('');
}

async function toggleBlockUser(phone){
  var users=loadUsers();
  var u=users.find(x=>x.phone===phone);
  if(!u)return;
  var prev=u.blocked; // احفظ الحالة للـ rollback
  u.blocked=!u.blocked;
  saveUsers(users);
  renderUsersPanel();
  toast(u.blocked?'🚫 تم حظر المستخدم':'✅ تم رفع الحظر');
  try{
    await saveUserToSB(u);
  } catch(e){
    console.error('toggleBlockUser SB error:', e.message);
    // rollback — أرجع الحالة القديمة لو فشل الحفظ
    u.blocked=prev;
    saveUsers(users);
    renderUsersPanel();
    toast('⚠️ فشل الحفظ في السيرفر، حاول مجدداً');
  }
}

/* ════════ DB CONNECTION TEST ════════ */
async function testDBConnection(){
  var el = document.getElementById('db-test-result');
  if(el){ el.textContent='⏳ جاري الاختبار...'; el.style.color='#b45309'; el.style.display='block'; }
  var results = [];
  var tables = ['ads','settings','users'];
  var allOk = true;
  for(var i=0;i<tables.length;i++){
    var tbl = tables[i];
    try{
      var res = await fetch(SUPABASE_URL+'/rest/v1/'+tbl+'?select=*&limit=1', {
        headers:{
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Accept': 'application/json'
        }
      });
      var body; try{ body=await res.json(); }catch(e){ body=null; }
      if(res.ok){
        var count = Array.isArray(body) ? body.length : '?';
        results.push('✅ '+tbl+' — متاح ('+count+' سجل ظاهر)');
      } else {
        allOk = false;
        var errMsg = body&&body.message ? body.message : ('HTTP '+res.status);
        if(res.status===404) errMsg = 'الجدول غير موجود — شغّل supabase_setup.sql';
        else if(res.status===401||res.status===403) errMsg = 'RLS يمنع الوصول — عطّل RLS أو أضف Policies';
        results.push('❌ '+tbl+' — '+errMsg);
      }
    } catch(e){
      allOk = false;
      results.push('❌ '+tbl+' — '+e.message);
    }
  }
  var summary = allOk ? '✅ قاعدة البيانات تعمل بشكل صحيح' : '⚠️ يوجد مشكلة في قاعدة البيانات';
  var html = '<div style="font-weight:800;font-size:13px;margin-bottom:8px;color:'+(allOk?'#166534':'#dc2626')+'">'+summary+'</div>';
  html += results.map(function(r){
    return '<div style="font-size:12px;padding:4px 0;border-bottom:1px solid #f0f0f0">'+r+'</div>';
  }).join('');
  if(!allOk){
    html += '<div style="margin-top:10px;padding:10px;background:#fef3c7;border-radius:8px;font-size:11px;color:#92400e;line-height:1.7">'
      +'<b>الحل:</b><br>'
      +'١. افتح <b>Supabase Dashboard → SQL Editor</b><br>'
      +'٢. شغّل ملف <b>supabase_setup.sql</b> المرفق<br>'
      +'٣. اضغط "اختبار الاتصال" مرة أخرى'
    +'</div>';
  }
  if(el){ el.innerHTML=html; el.style.color=''; }
  toast(allOk ? '✅ الاتصال يعمل' : '❌ يوجد مشكلة — راجع النتيجة');
}

function renderSettingsPanel(){
  var s=loadSettings();
  document.getElementById('setting-price').value=s.featuredPrice||'50';
  var vp=document.getElementById('setting-verify-price'); if(vp) vp.value=s.verifyPrice||'100';
  document.getElementById('setting-vodafone').value=s.vodafoneNum||'01005581620';
  document.getElementById('setting-wa').value=s.adminWa||'01040986955';
  document.getElementById('setting-pass').value='';
  // أضف زرار اختبار الاتصال لو مش موجود
  var testSection = document.getElementById('db-test-section');
  if(!testSection){
    var settingsEl = document.getElementById('atab-settings');
    if(settingsEl){
      var sec = document.createElement('div');
      sec.id = 'db-test-section';
      sec.className = 'settings-section';
      sec.innerHTML =
        '<div class="settings-section-title">🔌 اختبار قاعدة البيانات</div>'+
        '<div style="font-size:12px;color:#3d4a5c;margin-bottom:10px">تحقق من الاتصال بـ Supabase والجداول المطلوبة</div>'+
        '<button onclick="testDBConnection()" style="background:linear-gradient(135deg,#023e8a,#0077b6);color:white;border:none;padding:10px 20px;border-radius:12px;font-family:Cairo,sans-serif;font-weight:700;font-size:13px;cursor:pointer;width:100%;margin-bottom:10px">🔌 اختبار الاتصال</button>'+
        '<div id="db-test-result" style="display:none;background:#f8faff;border:1px solid #e0e8f0;border-radius:12px;padding:12px;font-family:Cairo,sans-serif;line-height:1.8"></div>';
      settingsEl.insertBefore(sec, settingsEl.firstChild);
    }
  }
}

function clearAllData(){
  if(!confirm('هتمسح كل الإعلانات والبيانات نهائياً — متعملش كده غير لو متأكد!')) return;
  // مسح البيانات المحلية
  ['fares_ads','fares_views','fares_favs','fares_users','fares_ad_counter',
   'fares_current_user','fares_broker_profile','fares_saved_phones','fares_settings',
   'fares_db_cache','fares_users_cache','fares_settings_cache'].forEach(function(k){
    localStorage.removeItem(k);
  });
  // مسح الـ cache في الذاكرة
  _dbCache = null;
  _dbCacheTime = 0;
  _usersCache = null;
  _settingsCache = null;
  currentUser = null;
  toast('✅ تم مسح البيانات المحلية — بيانات السيرفر لم تتأثر');
  setTimeout(function(){ location.reload(); }, 1000);
}

function saveSettings(){
  var newPass=document.getElementById('setting-pass').value.trim();
  var s={
    featuredPrice:document.getElementById('setting-price').value,
    verifyPrice:(document.getElementById('setting-verify-price')||{value:'100'}).value,
    vodafoneNum:document.getElementById('setting-vodafone').value,
    adminWa:document.getElementById('setting-wa').value
  };
  // احتفظ بكلمة السر الحالية لو ما في تغيير
  var existing = loadSettings();
  s.adminPass = existing.adminPass || ADMIN_PASS;
  if(newPass && newPass.length>=4){
    s.adminPass = newPass;
    saveSettings2(s);
    toast('✅ تم حفظ الإعدادات وتغيير كلمة السر');
  } else {
    saveSettings2(s);
    toast('✅ تم حفظ الإعدادات');
  }
}

async function approveAd(id){
  var db=loadDB();
  var idx=db.pending.findIndex(a=>a.id===id);
  if(idx===-1){toast('إعلان غير موجود');return;}
  var ad=db.pending.splice(idx,1)[0];
  if(!db.approved) db.approved=[];
  db.approved.unshift(ad);
  saveDB(db);
  try{
    await _upsertAdSB(ad,'approved');
    _dbCacheTime = 0;
    await loadDBAsync(true);
  } catch(e){ console.error('approveAd error:', e.message); toast('❌ خطأ في النشر: '+e.message); return; }
  renderAdminPanel(); updateNotifDot();
  toast('✅ تم نشر الإعلان وإشعار المعلن');
  // إشعار حقيقي للمستخدم لو التطبيق مفتوح
  notifyUserAdApproved(ad);
  var clean=ad.phone.replace(/\s/g,'').replace(/^0/,'20');
  var msg='مرحباً '+ad.ownerName+' 🎉\n\nتم قبول ونشر إعلانك على موقع *ديار* 🏠\n\nإعلانك متاح الآن للجميع على الموقع.\nشكراً لثقتك بنا! 🌊';
  window.open('https://wa.me/'+clean+'?text='+encodeURIComponent(msg),'_blank');
}

function notifyUserAdApproved(ad){
  // إشعار للمستخدم لو التطبيق مفتوح
  if(currentUser && (currentUser.phone === ad.phone || currentUser.phone === ad.submitterPhone)){
    showSmartToast('🎉', 'تم قبول إعلانك!', '', 'success', 8000);
  }
  // إشعار النظام لو مسموح
  if('Notification' in window && Notification.permission === 'granted'){
    new Notification('ديار 🏠', {
      body: 'تم قبول ونشر إعلانك · ' + ad.ownerName,
      icon: '/icon-192.png'
    });
  }
}

async function rejectAd(id){
  var db=loadDB();
  var idx=db.pending.findIndex(a=>a.id===id);
  if(idx===-1){toast('إعلان غير موجود');return;}
  var ad=db.pending.splice(idx,1)[0];
  saveDB(db);
  try{
    await deleteAdFromSB(id);
    _dbCacheTime = 0;
    await loadDBAsync(true);
  } catch(e){ console.error('rejectAd error:', e.message); }
  renderAdminPanel(); updateNotifDot();
  toast('🗑️ تم رفض الإعلان');
  var clean=ad.phone.replace(/\s/g,'').replace(/^0/,'20');
  var msg='مرحباً '+ad.ownerName+'\n\nللأسف لم يتم قبول إعلانك على موقع *ديار* حالياً.\n\nيمكنك التواصل معنا لمعرفة السبب أو إعادة المحاولة بعد التعديل.';
  window.open('https://wa.me/'+clean+'?text='+encodeURIComponent(msg),'_blank');
}

async function deleteAd(id){
  var db=loadDB();
  db.approved=(db.approved||[]).filter(a=>a.id!==id);
  saveDB(db);
  try{
    await deleteAdFromSB(id);
    _dbCacheTime = 0;
    await loadDBAsync(true);
  } catch(e){ console.error('deleteAd error:', e.message); }
  renderAdminPanel();
  toast('🗑️ تم حذف الإعلان');
}

/* ════════ MY ADS ════════ */
var _editingAdId = null;
var _editingAdSource = null; // 'pending' or 'approved'

function getMyPhone(){
  if(currentUser && currentUser.phone) return currentUser.phone;
  var bp = loadBrokerProfile();
  if(bp) return bp.linkedPhone || bp.phone;
  return null;
}

function getMyAds(){
  var db = loadDB();
  var myPhone = getMyPhone();
  if(!myPhone) return {pending:[], approved:[]};
  var phones = [myPhone];
  var _mbp = loadBrokerProfile();
  if(_mbp && _mbp.phone && _mbp.phone !== myPhone) phones.push(_mbp.phone);
  function _match(a){ return phones.some(function(p){ return a.submitterPhone===p || a.phone===p; }); }
  return {
    pending:  (db.pending||[]).filter(_match),
    approved: (db.approved||[]).filter(_match)
  };
}

function updateMyAdsCard(){
  var mine = getMyAds();
  var hasApproved = mine.approved.length > 0;
  var hasPending  = mine.pending.length  > 0;

  // badge + sub على مربع إعلاناتي في broker-home-card
  var ownerBadge = document.getElementById('owner-badge');
  var ownerSub   = document.getElementById('owner-myads-sub');
  if(ownerBadge){
    if(hasPending){ ownerBadge.textContent=mine.pending.length; ownerBadge.style.display='flex'; }
    else ownerBadge.style.display='none';
  }
  if(ownerSub){
    if(hasApproved && hasPending){
      ownerSub.textContent = mine.approved.length + ' منشور · ' + mine.pending.length + ' قيد المراجعة';
    } else if(hasApproved){
      ownerSub.textContent = mine.approved.length + ' إعلان منشور';
    } else if(hasPending){
      ownerSub.textContent = mine.pending.length + ' إعلان قيد المراجعة';
    } else {
      ownerSub.textContent = '';
    }
  }

  // ─── My Ads Card — يظهر فقط لو عنده معلقة بدون منشورة وبدون broker profile ───
  var myAdsCard = document.getElementById('my-ads-card');
  var badge     = document.getElementById('my-ads-badge');
  var hasBrokerProfile = (function(){ var p=loadBrokerProfile(); return !!(p && p.name); })();
  if(myAdsCard){
    if(hasPending && !hasApproved && !hasBrokerProfile){
      myAdsCard.style.display = 'block';
      if(badge){ badge.textContent=mine.pending.length; badge.style.display='flex'; }
      var _mst=document.getElementById('my-ads-sub-text'); if(_mst) _mst.textContent = mine.pending.length + ' إعلان قيد المراجعة';
    } else {
      myAdsCard.style.display = 'none';
    }
  }

  // الإعلانات المعلقة تظهر فقط داخل صفحة "إعلاناتي" — لا تُعرض في الهوم
  var el = document.getElementById('home-pending-preview');
  if(el) el.innerHTML = '';
}

function renderHomePendingPreview(pending){
  var el = document.getElementById('home-pending-preview');
  if(!pending || !pending.length){el.innerHTML='';return;}
  var pl={apt:'شقة / بيت',land:'أرض',shop:'محل'};
  var pe={apt:'🏠',land:'🌍',shop:'🏪'};
  el.innerHTML = pending.map(function(a){
    var safeId = escapeHTML(a.id||'');
    var safeRegion = escapeHTML(a.region||'');
    var safeAdCode = a.adCode ? escapeHTML(a.adCode) : '';
    var safeSubmittedAt = escapeHTML(a.submittedAt||'');
    var imgHtml = a.photos && a.photos.length
      ? '<img src="'+escapeHTML(a.photos[0])+'" style="width:100%;height:140px;object-fit:cover;border-radius:0">'
      : '<div style="width:100%;height:80px;background:linear-gradient(135deg,#fffbeb,#fef3c7);display:flex;align-items:center;justify-content:center;font-size:44px">'+(pe[a.propType]||'🏠')+'</div>';
    return '<div style="border:2px solid #fbbf24;border-top:none;border-radius:0 0 20px 20px;overflow:hidden;margin-bottom:4px;background:white">'+
      imgHtml+
      '<div style="padding:14px 16px">'+
        '<div style="display:inline-flex;align-items:center;gap:5px;background:#fef3c7;color:#92400e;padding:4px 12px;border-radius:50px;font-size:11px;font-weight:800;border:1px solid #fbbf24;margin-bottom:10px">⏳ قيد المراجعة</div>'+
        '<div style="font-size:15px;font-weight:800;color:#1a2744;margin-bottom:3px">'+(pl[a.propType]||'عقار')+' في '+safeRegion+'</div>'+
        (safeAdCode?'<div style="font-size:11px;color:#a0aec0;font-weight:700;margin-bottom:4px">#'+safeAdCode+'</div>':'')+
        '<div style="font-size:13px;color:#3d4a5c;margin-bottom:6px">💰 '+Number(a.price).toLocaleString('ar-EG')+' ج.م'+(a.size?' · '+(a.propType==='apt'?a.size+' غرف':a.size+' م²'):'')+' · 📍 '+safeRegion+'</div>'+
        '<div style="font-size:11px;color:#b45309;margin-bottom:12px">🕐 '+safeSubmittedAt+'</div>'+
        '<button onclick="event.stopPropagation();deleteMyAdFromHome(\''+safeId+'\')" style="background:#fee2e2;color:#dc2626;border:2px solid #fecaca;padding:10px;width:100%;border-radius:12px;font-family:Cairo,sans-serif;font-weight:700;font-size:13px;cursor:pointer">🗑️ حذف الإعلان</button>'+
      '</div>'+
    '</div>';
  }).join('');
}

function deleteMyAdFromHome(id){
  if(!confirm('هل تريد حذف هذا الإعلان؟')) return;
  var db=loadDB();
  db.pending=(db.pending||[]).filter(a=>a.id!==id);
  saveDB(db);
  deleteAdFromSB(id).catch(function(e){ console.error('deleteMyAdFromHome SB error:', e.message); });
  updateNotifDot(); updateMyAdsCard();
  toast('🗑️ تم حذف الإعلان');
}

function renderMyAds(){
  var grid = document.getElementById('myads-grid');
  // لو الـ cache فارغة، اعرض مؤشر تحميل
  if(!_dbCache && grid){
    grid.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#8a9ab8"><div style="font-size:36px;margin-bottom:12px">⏳</div><div style="font-size:14px;font-weight:700">جاري التحميل...</div></div>';
  } else {
    _doRenderMyAds();
  }
  // حدّث من Supabase دايماً
  loadDBAsync().then(function(){ _doRenderMyAds(); }).catch(function(){ _doRenderMyAds(); });
}
function _doRenderMyAds(){
  var mine = getMyAds();
  var all = mine.pending.map(function(a){return Object.assign({},a,{_status:'pending'});})
    .concat(mine.approved.map(function(a){return Object.assign({},a,{_status:'approved'});}));
  var grid = document.getElementById('myads-grid');
  var sub = document.getElementById('myads-sub');

  if(!all.length){
    sub.textContent = '';
    grid.innerHTML = '<div class="empty-myads"><div class="eico">📭</div>'+
      '<div style="font-weight:700;font-size:16px;color:#1a2744;margin-bottom:8px">لا توجد إعلانات بعد</div>'+
      '<div style="font-size:13px;margin-bottom:16px">ابدأ بإضافة أول إعلان لك!</div>'+
      '<button onclick="go(\'add\')" style="background:linear-gradient(135deg,#023e8a,#0077b6);color:white;border:none;padding:13px 28px;border-radius:14px;font-family:Cairo,sans-serif;font-weight:700;cursor:pointer;font-size:15px">➕ أضف إعلان</button></div>';
    return;
  }

  sub.textContent = all.length + ' إعلان (' + mine.approved.length + ' منشور · ' + mine.pending.length + ' في الانتظار)';
  var pl={apt:'شقة / بيت',land:'أرض',shop:'محل'};
  var pe={apt:'🏠',land:'🌍',shop:'🏪'};

  grid.innerHTML = all.map(function(a){
    var isFeatured = !!a.featured;
    var isPending  = a._status === 'pending';
    var imgHtml = a.photos && a.photos.length
      ? '<div class="listing-img-box" style="height:150px"><img src="'+a.photos[0]+'" alt="" style="width:100%;height:100%;object-fit:cover"></div>'
      : '<div class="listing-img-box" style="height:100px;font-size:50px">'+(pe[a.propType]||'🏠')+'</div>';

    var statusBadge = isPending
      ? '<span class="my-ad-status status-pending">⏳ قيد المراجعة</span>'
      : isFeatured
        ? '<span class="my-ad-status status-featured">⭐ مميز ومنشور</span>'
        : '<span class="my-ad-status status-approved">✅ منشور</span>';

    var cardClass = 'my-ad-card' + (isPending?' pending-ad':'') + (isFeatured?' featured-ad':'');

    // Actions row — pending: delete only | approved: edit + delete + star
    var actionsHtml;
    if(isPending){
      actionsHtml = '<div class="my-ad-actions" style="grid-template-columns:1fr">'+
        '<button class="mya-btn mya-del" style="width:100%" onclick="deleteMyAd(\''+a.id+'\',\'pending\')"><span class="mico">🗑️</span>حذف الإعلان</button>'+
      '</div>';
    } else {
      var editBtn = '<button class="mya-btn mya-edit" onclick="openEditModal(\''+a.id+'\',\'approved\')"><span class="mico">✏️</span>تعديل</button>';
      var delBtn  = '<button class="mya-btn mya-del"  onclick="deleteMyAd(\''+a.id+'\',\'approved\')"><span class="mico">🗑️</span>حذف</button>';
      var starBtn = '<button class="mya-btn mya-star'+(isFeatured?' active':'')+'" onclick="requestFeaturedFromMyAds(\''+a.id+'\')"><span class="mico">'+(isFeatured?'⭐':'☆')+'</span>'+(isFeatured?'مميز':'مَيِّز')+'</button>';
      actionsHtml = '<div class="my-ad-actions">'+editBtn+delBtn+starBtn+'</div>';
    }

    return '<div class="'+cardClass+'">'+imgHtml+
      '<div class="listing-body">'+
        statusBadge+
        '<div class="listing-title">'+(pl[a.propType]||'عقار')+' في '+a.region+'</div>'+
        '<div class="listing-loc">📍 '+a.region+' · 🕐 '+a.submittedAt+'</div>'+
        '<div class="listing-price">'+Number(a.price).toLocaleString('ar-EG')+' <span>ج.م</span></div>'+
      '</div>'+
      actionsHtml+
    '</div>';
  }).join('');
}

function deleteMyAd(id, source){
  if(!confirm('هل تريد حذف هذا الإعلان؟')) return;
  var db = loadDB();
  if(source === 'pending'){
    db.pending = (db.pending||[]).filter(a=>a.id!==id);
  } else {
    db.approved = (db.approved||[]).filter(a=>a.id!==id);
  }
  saveDB(db);
  deleteAdFromSB(id).catch(function(e){ console.error('deleteMyAd SB error:', e.message); });
  updateMyAdsCard();
  renderMyAds();
  toast('🗑️ تم حذف الإعلان');
}

function openEditModal(id, source){
  var db = loadDB();
  var list = source === 'pending' ? (db.pending||[]) : (db.approved||[]);
  var ad = list.find(a=>a.id===id);
  if(!ad){toast('⚠️ الإعلان غير موجود');return;}
  _editingAdId = id;
  _editingAdSource = source;
  document.getElementById('edit-name').value = ad.ownerName||'';
  document.getElementById('edit-region').value = ad.region||'';
  document.getElementById('edit-price').value = ad.price||'';
  document.getElementById('edit-size').value = ad.size||'';
  document.getElementById('edit-phone').value = ad.phone||'';
  document.getElementById('edit-desc').value = ad.desc||'';
  document.getElementById('edit-size-lbl').textContent = ad.propType==='apt'?'عدد الغرف':'المساحة (م²)';
  (function(){var _e=document.getElementById('edit-overlay');if(_e)_e.classList.remove('hidden')})();
}

function closeEditModal(){
  (function(){var _e=document.getElementById('edit-overlay');if(_e)_e.classList.add('hidden')})();
  _editingAdId = null; _editingAdSource = null;
}

function saveEditAd(){
  if(!_editingAdId) return;
  var db = loadDB();
  var list = _editingAdSource === 'pending' ? (db.pending||[]) : (db.approved||[]);
  var ad = list.find(a=>a.id===_editingAdId);
  if(!ad){toast('⚠️ الإعلان غير موجود');closeEditModal();return;}
  var newName = document.getElementById('edit-name').value.trim();
  var newRegion = document.getElementById('edit-region').value;
  var newPrice = document.getElementById('edit-price').value;
  var newPhone = document.getElementById('edit-phone').value.trim();
  var newDesc = document.getElementById('edit-desc').value.trim();
  var newSize = document.getElementById('edit-size').value;
  if(!newName){toast('⚠️ أدخل الاسم');return;}
  if(!newRegion){toast('❌ اختر المنطقة من القائمة');return;}
  if(!newPrice || isNaN(Number(newPrice)) || Number(newPrice) <= 0){toast('❌ السعر يجب أن يكون رقمًا أكبر من الصفر');return;}
  if(!newPhone||!/^(010|011|012|015)\d{8}$/.test(newPhone)){toast('⚠️ رقم غير صحيح');return;}
  ad.ownerName = newName;
  ad.region = newRegion;
  ad.price = newPrice;
  ad.phone = newPhone;
  // لا نغير submitterPhone — هو رقم الدخول اللي بيُستخدم لتحديد صاحب الإعلان
  ad.desc = newDesc;
  ad.size = newSize;
  ad.editedAt = new Date().toLocaleString('ar-EG');
  saveDB(db);
  var adStatus = _editingAdSource === 'pending' ? 'pending' : 'approved';
  saveAdToSB(ad, adStatus).catch(function(e){ console.error('saveEditAd SB error:', e.message); });
  closeEditModal();
  renderMyAds();
  toast('✅ تم حفظ التعديلات');
}

var _featuredAdId = null;

function requestFeaturedFromMyAds(id){
  var db = loadDB();
  var ad = (db.approved||[]).find(a=>a.id===id) || (db.pending||[]).find(a=>a.id===id);
  if(!ad) return;
  if(ad.featured){toast('⭐ إعلانك مميز بالفعل!');return;}
  _featuredAdId = id;
  // تحديث الرقم والسعر من الإعدادات
  var settings = loadSettings();
  var walletNum = settings.vodafoneNum || '01005581620';
  var price     = settings.featuredPrice || '50';
  document.getElementById('pay-wallet-num').textContent  = walletNum;
  document.getElementById('pay-price-pill').textContent  = price;
  document.getElementById('pay-price-step').textContent  = price;
  (function(){var _e=document.getElementById('pay-overlay');if(_e)_e.classList.remove('hidden')})();
}

function closePayOverlay(){
  (function(){var _e=document.getElementById('pay-overlay');if(_e)_e.classList.add('hidden')})();
  _featuredAdId = null;
}

function copyWalletNum(){
  var num = document.getElementById('pay-wallet-num').textContent;
  navigator.clipboard.writeText(num).then(function(){
    toast('📋 تم نسخ الرقم: ' + num);
  }).catch(function(){
    toast('الرقم: ' + num);
  });
}

function sendFeaturedFromPopup(){
  var db = loadDB();
  // ابحث في approved أو pending
  var ad = null;
  if(_featuredAdId){
    ad = (db.approved||[]).find(a=>a.id===_featuredAdId)
      || (db.pending||[]).find(a=>a.id===_featuredAdId);
  }
  var settings = loadSettings();
  var waNum = (settings.adminWa||ADMIN_NUMBER).replace(/^0/,'20');
  var price = settings.featuredPrice || '50';
  var pl={apt:'شقة / بيت',land:'أرض',shop:'محل'};
  var msg = '⭐ *طلب تمييز إعلان*\n';
  msg += '━━━━━━━━━━━━━━━━━\n';
  if(ad){
    msg += '🔢 *كود الإعلان:* ' + (ad.adCode ? '#'+ad.adCode : '(بدون كود)') + '\n';
    msg += '👤 *المعلن:* '      + ad.ownerName + '\n';
    msg += '📞 *الواتساب:* '    + ad.phone + '\n';
    msg += '🏠 *النوع:* '       + (pl[ad.propType]||ad.propType) + '\n';
    msg += '📍 *المنطقة:* '     + ad.region + '\n';
    msg += '💰 *السعر:* '       + Number(ad.price).toLocaleString('ar-EG') + ' ج.م\n';
    if(ad.size) msg += (ad.propType==='apt'?'🛏 *الغرف:* ':'📐 *المساحة:* ') + ad.size + '\n';
  }
  msg += '━━━━━━━━━━━━━━━━━\n';
  msg += '💳 *تم تحويل ' + price + ' ج.م فودافون كاش*\nرجاء تمييز الإعلان بالإطار الذهبي ⭐🙏';
  window.open('https://wa.me/'+waNum+'?text='+encodeURIComponent(msg),'_blank');
  closePayOverlay();
  toast('📲 تم فتح واتساب — أرسل إيصال التحويل للإدارة');
}

function adminSearchAds(){
  var q = document.getElementById('admin-search-input').value.trim().toLowerCase();
  var resEl = document.getElementById('admin-search-results');
  var pendingEl = document.getElementById('pending-list');
  var approvedEl = document.getElementById('approved-section');
  if(!q){ resEl.style.display='none'; pendingEl.style.display=''; approvedEl.style.display=''; return; }
  pendingEl.style.display='none'; approvedEl.style.display='none'; resEl.style.display='block';
  var db=loadDB();
  var all=((db.pending||[]).map(a=>Object.assign({},a,{_src:'pending'})))
    .concat((db.approved||[]).map(a=>Object.assign({},a,{_src:'approved'})));
  var found=all.filter(function(a){
    return (a.adCode&&a.adCode.toLowerCase().indexOf(q)!==-1)
      || (a.ownerName&&a.ownerName.indexOf(q)!==-1)
      || (a.phone&&a.phone.indexOf(q)!==-1)
      || (a.region&&a.region.indexOf(q)!==-1);
  });
  var pl={apt:'شقة / بيت',land:'أرض',shop:'محل'};
  if(!found.length){ resEl.innerHTML='<div class="empty-admin">🔍 لا توجد نتائج</div>'; return; }
  resEl.innerHTML='<div class="sec-header"><div class="sec-header-title">🔍 نتائج البحث <span class="sec-badge sec-badge-green">'+found.length+'</span></div></div>'+
    found.map(function(a){
      var srcBadge = a._src==='pending'
        ? '<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:50px;font-size:11px;font-weight:700">⏳ انتظار</span>'
        : '<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:50px;font-size:11px;font-weight:700">✅ منشور</span>';
      return '<div class="approved-card">'+
        '<div class="approved-card-info" style="flex:1">'+
          '<div class="approved-card-title">'+(a.adCode?'<b>#'+a.adCode+'</b> · ':'')+' '+(pl[a.propType]||'عقار')+' · '+a.region+'</div>'+
          '<div class="approved-card-sub">'+a.ownerName+' · '+a.phone+'</div>'+
          '<div class="approved-card-price">'+Number(a.price).toLocaleString('ar-EG')+' ج.م · '+srcBadge+'</div>'+
        '</div>'+
        (a._src==='approved'?'<div style="display:flex;gap:6px"><button class="ac-btn ac-star'+(a.featured?' on':'')+'" onclick="toggleFeaturedAd(\''+a.id+'\')">⭐</button><button class="ac-btn ac-del" onclick="deleteAd(\''+a.id+'\')">🗑️</button></div>':
        '<button class="btn-reject" style="padding:8px 12px;font-size:12px" onclick="rejectAd(\''+a.id+'\')">❌ رفض</button>')+
      '</div>';
    }).join('');
}

/* ════════ RESET ════════ */
function resetForm(){
  propType='';dealType='';nearSea='';finishVal='';aptFurnish='';aptPayment='';selectedChips={};uploadedPhotos=[];
  window._uploadedPhotoFiles=[];
  ['apt','land','shop','sale','rent'].forEach(v=>{var b=document.getElementById('btn-'+v);if(b)b.classList.remove('on');});
  ['btn-shop-sale','btn-shop-rent','btn-pay-cash','btn-pay-install'].forEach(function(id){var b=document.getElementById(id);if(b)b.classList.remove('on');});
  shopPayment=''; aptFurnish=''; aptPayment='';
  ['btn-furn-yes','btn-furn-no','btn-apt-cash','btn-apt-install'].forEach(function(id){var b=document.getElementById(id);if(b)b.classList.remove('on');});
  ['apt-sale-extras','apt-area-wrap'].forEach(id=>hide(id));
  ['deal-sec','land-note','shop-deal-sec','shop-payment-row','rent-box','svc-box','finish-box','rest-form','floor-row','sea-row','shop-area-row','svc-summary','finish-summary'].forEach(id=>hide(id));
  document.querySelectorAll('.chip,.sea-btn,.finish-btn').forEach(b=>b.classList.remove('on'));
  ['region','price','size','apt-area','floor','phone','desc','shopfront','owner-name'].forEach(id=>{var e=document.getElementById(id);if(e)e.value='';});
  var ph2=document.getElementById('price-hint');if(ph2)ph2.textContent='';
  var rt=document.getElementById('rentType');if(rt)rt.value='يومي';
  var prev=document.getElementById('photo-previews');if(prev){prev.innerHTML='';prev.style.display='none';}
  var ph=document.getElementById('photo-placeholder');if(ph)ph.style.display='';
  // Reset featured
  featuredEnabled=false;
  var sw=document.getElementById('featured-toggle-sw');if(sw)sw.classList.remove('on');
  var pb=document.getElementById('featured-payment-box');if(pb)pb.style.display='none';
  var ti=document.getElementById('transfer-preview-img');if(ti){ti.style.display='none';ti.src='';}
}

/* INIT */
updateNotifDot();
document.getElementById('preview-overlay').addEventListener('click',function(e){if(e.target===this)closePreview();});
document.getElementById('edit-overlay').addEventListener('click',function(e){if(e.target===this)closeEditModal();});
document.getElementById('pay-overlay').addEventListener('click',function(e){if(e.target===this)closePayOverlay();});
// PWA-first: لو متصفح عادي → PWA overlay بس، لو standalone → تسجيل دخول
window.addEventListener('load', async function(){
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
    || document.referrer.includes('android-app://');

  // أخفِ الـ pwa-overlay فوراً في كل الحالات (CSS مش بيتحكم فيه)
  var _pwaEl = document.getElementById('pwa-overlay');
  if(_pwaEl) _pwaEl.style.display = 'none';

  if(isStandalone){
    document.body.classList.add('app-ready');
    var savedUser = null;
    try{ savedUser = JSON.parse(localStorage.getItem('fares_current_user')||'null'); }catch(e){}
    if(savedUser && savedUser.phone){
      currentUser = savedUser;
      document.getElementById('otp-overlay').style.display = 'none';
      updateUserBadge();
      if(savedUser.isAdmin){ var _fab2=document.getElementById('admin-fab'); if(_fab2) _fab2.style.display='flex'; }
      // عرض من الـ cache المحفوظ فوراً
      updateBrokerHomeCard();
      updateMyAdsCard();
      toast('🎉 مرحباً بعودتك!');
      startRealtimeSync();
      // استعادة كاملة من Supabase في الخلفية (ملف شخصي + إعلانات)
      if(!savedUser.isAdmin) restoreUserSession(savedUser.phone);
    } else {
      var savedProfile = loadBrokerProfile();
      if(savedProfile){
        var _alo1=document.getElementById('otp-overlay'); if(_alo1) _alo1.style.display='flex';document.getElementById('otp-welcome').textContent = 'مرحباً، '+savedProfile.name+' 👋';
        document.getElementById('otp-welcome-sub').textContent = 'أدخل رقمك وكلمة المرور للدخول';
        if(savedProfile.linkedPhone){
          document.getElementById('otp-phone').value = savedProfile.linkedPhone;
          var pwInp = document.getElementById('otp-password');
          if(pwInp) pwInp.focus();
        } else {
          loadSavedPhones();
        }
      } else {
        var _alo2=document.getElementById('otp-overlay'); if(_alo2) _alo2.style.display='flex';
        loadSavedPhones();
      }
    }
  } else {
    // مفتوح من المتصفح — اعرض صفحة التحميل فقط
    var _otp = document.getElementById('otp-overlay');
    if(_otp) _otp.style.display = 'none';
    var _wrap = document.querySelector('.wrap');
    if(_wrap) _wrap.style.display = 'none';
    var _footer = document.querySelector('.site-footer');
    if(_footer) _footer.style.display = 'none';
    var _header = document.querySelector('.header');
    if(_header) _header.style.display = 'none';
    // اعرض الـ pwa-overlay
    if(_pwaEl) _pwaEl.style.display = 'flex';
    return;
  }

  updateMyAdsCard();
  updateFavsCard();
  updateBrokerHomeCard();

  // ── Prefetch في الخلفية فوراً — المستخدم يحتاج البيانات لما يضغط ──
  // شغّل بدون await عشان ما يبطئش الـ UI
  loadDBAsync().then(function(){
    updateMyAdsCard();
    updateFavsCard();
    updateNotifDot();
    var db = loadDB();
    var total = (db.approved||[]).length + (db.pending||[]).length;
    if(total) toast('✅ متصل — ' + total + ' إعلان');
  }).catch(function(e){ toast('❌ خطأ في الاتصال: ' + e.message); });

  // جيب الإعدادات والمستخدمين في الخلفية كمان
  loadUsersAsync().catch(function(){});
  loadSettingsAsync().catch(function(){});

  // ابدأ الـ realtime sync من الآن (مش بس بعد login)
  startRealtimeSync();
});

/* ════════ BROKER PROFILE ════════ */
var _regAccountType = '';

function loadBrokerProfile(){
  try{ return JSON.parse(localStorage.getItem('fares_broker_profile')||'null'); }catch(e){return null;}
}
function saveBrokerProfile(p){ localStorage.setItem('fares_broker_profile',JSON.stringify(p)); }

function selectAccountType(type){
  _regAccountType = type;
  document.getElementById('acc-broker').classList.toggle('on', type==='سمسار');
  document.getElementById('acc-owner').classList.toggle('on', type==='مالك');
}

function handleRegPhoto(input){
  if(!input.files||!input.files[0]) return;
  var reader=new FileReader();
  reader.onload=function(e){
    var src=e.target.result;
    var icon=document.getElementById('reg-avatar-icon');
    var img=document.getElementById('reg-avatar-img');
    if(icon) icon.style.display='none';
    if(img){img.src=src;img.style.display='block';}
    // store temp for save
    document._regPhotoData=src;
  };
  reader.readAsDataURL(input.files[0]);
}

function saveProfile(){
  var name=document.getElementById('reg-name').value.trim();
  var phone=document.getElementById('reg-phone').value.trim();
  if(!_regAccountType){toast('⚠️ اختر نوع الحساب (سمسار أو مالك)');return;}
  if(!name){toast('⚠️ أدخل اسمك الكامل');return;}
  if(!phone||!/^(010|011|012|015)\d{8}$/.test(phone)){toast('⚠️ أدخل رقم واتساب صحيح');return;}
  var photo = document._regPhotoData || (loadBrokerProfile()||{}).photo || '';
  var profile={name,phone,accountType:_regAccountType,photo,linkedPhone: currentUser?currentUser.phone:phone};
  saveBrokerProfile(profile);
  // حفظ في Supabase في الخلفية
  saveUserProfileToSB(profile).catch(function(){});
  updateBrokerHomeCard();
  toast('✅ تم حفظ حسابك بنجاح!');
  go('home');
}

async function saveUserProfileToSB(profile){
  try{
    // أولاً حفظ في localStorage عشان renderBrokersPanel تشتغل
    var users = loadUsers();
    var existing = users.find(function(u){ return u.phone === (profile.linkedPhone||profile.phone); });
    if(existing){
      existing.profile_name = profile.name;
      existing.profile_type = profile.accountType;
      existing.profile_phone = profile.phone;
      existing.profile_photo = profile.photo || '';
    } else {
      users.push({
        phone: profile.linkedPhone||profile.phone,
        blocked: false,
        joinedAt: new Date().toLocaleString('ar-EG'),
        profile_name: profile.name,
        profile_type: profile.accountType,
        profile_phone: profile.phone,
        profile_photo: profile.photo || ''
      });
    }
    saveUsers(users);
    // بعدين Supabase في الخلفية
    var _pres = await fetch(SUPABASE_URL + '/rest/v1/users', {
      method: 'POST',
      headers:{
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify({
        phone: profile.linkedPhone || profile.phone,
        blocked: false,
        joined_at: new Date().toISOString(),
        profile_name: profile.name,
        profile_type: profile.accountType,
        profile_phone: profile.phone,
        profile_photo: profile.photo || ''
      })
    });
    if(!_pres.ok){
      var _pe=null; try{_pe=await _pres.json();}catch(e){}
      console.error('saveUserProfileToSB failed:', _pres.status, _pe);
      toast('⚠️ تعذر حفظ الملف الشخصي في قاعدة البيانات');
    }
  } catch(e){
    console.error('saveUserProfileToSB error:', e.message);
    if(navigator.onLine) toast('⚠️ تعذر مزامنة الملف الشخصي — ' + e.message);
  }
}

function updateBrokerHomeCard(){
  var profile=loadBrokerProfile();
  if(profile && currentUser && profile.linkedPhone && profile.linkedPhone !== currentUser.phone){ profile=null; }
  var brokerCard=document.getElementById('broker-home-card');
  var visitorChoices=document.getElementById('visitor-choices');
  var pendingPreview=document.getElementById('home-pending-preview');
  var myAdsCard=document.getElementById('my-ads-card');
  if(!brokerCard) return;
  if(profile){
    if(visitorChoices) visitorChoices.style.display='none';
    if(pendingPreview) pendingPreview.innerHTML='';
    if(myAdsCard) myAdsCard.style.display='none';
    brokerCard.style.display='block';
    var nameEl=document.getElementById('broker-home-name');
    var phoneEl=document.getElementById('broker-home-phone');
    var typeEl=document.getElementById('broker-home-type');
    var avatarEl=document.getElementById('broker-home-avatar');
    if(nameEl) nameEl.textContent='مرحباً، '+profile.name;
    if(phoneEl) phoneEl.textContent='📱 '+profile.phone;
    if(typeEl){
      var verifiedMark = profile.verified ? ' <span class="verified-badge">✓ موثق</span>' : '';
      typeEl.innerHTML = (profile.accountType==='سمسار'?'🤝 سمسار':'🏠 مالك') + verifiedMark;
    }
    // تحديث معلومات التوثيق في verify card عند الفتح تلقائياً (لا توجد عناصر ثابتة هنا)
    if(avatarEl){
      if(profile.photo){
        avatarEl.innerHTML='<img src="'+profile.photo+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
      } else {
        avatarEl.textContent=profile.accountType==='سمسار'?'🤝':'🏠';
      }
    }
  } else {
    if(visitorChoices) visitorChoices.style.display='block';
    brokerCard.style.display='none';
  }
}

function fillAddFormFromProfile(){
  var profile=loadBrokerProfile();
  var bar=document.getElementById('add-broker-bar');
  var nameGroup=document.getElementById('add-name-group');
  var phoneGroup=document.getElementById('add-phone-group');
  var phoneInput=document.getElementById('phone');
  var nameInput=document.getElementById('owner-name');
  if(profile){
    if(bar) bar.style.display='flex';
    if(nameGroup) nameGroup.style.display='none';
    if(phoneGroup) phoneGroup.style.display='none';
    var nl=document.getElementById('add-broker-name-lbl');
    var pl=document.getElementById('add-broker-phone-lbl');
    var tl=document.getElementById('add-broker-type-lbl');
    var av=document.getElementById('add-broker-avatar');
    var avImg=document.getElementById('add-broker-avatar-img');
    if(nl) nl.textContent=profile.name;
    if(pl) pl.textContent='📱 '+profile.phone;
    if(tl) tl.textContent=profile.accountType==='سمسار'?'🤝 سمسار':'🏠 مالك';
    if(av && profile.photo){
      av.style.position='relative';
      if(avImg){avImg.src=profile.photo;avImg.style.display='block';}
    }
    if(nameInput) nameInput.value=profile.name;
    if(phoneInput) phoneInput.value=profile.phone;
  } else {
    if(bar) bar.style.display='none';
    if(nameGroup) nameGroup.style.display='block';
    if(phoneGroup) phoneGroup.style.display='block';
  }
}

function loadRegisterForm(){
  var profile=loadBrokerProfile();
  _regAccountType='';
  document.getElementById('acc-broker').classList.remove('on');
  document.getElementById('acc-owner').classList.remove('on');
  if(profile){
    _regAccountType=profile.accountType;
    document.getElementById('acc-broker').classList.toggle('on',profile.accountType==='سمسار');
    document.getElementById('acc-owner').classList.toggle('on',profile.accountType==='مالك');
    document.getElementById('reg-name').value=profile.name||'';
    document.getElementById('reg-phone').value=profile.phone||'';
    var icon=document.getElementById('reg-avatar-icon');
    var img=document.getElementById('reg-avatar-img');
    if(profile.photo&&img){
      if(icon) icon.style.display='none';
      img.src=profile.photo; img.style.display='block';
      document._regPhotoData=profile.photo;
    } else {
      if(icon) icon.style.display='';
      if(img) img.style.display='none';
      document._regPhotoData='';
    }
  } else {
    document.getElementById('reg-name').value='';
    document.getElementById('reg-phone').value='';
    var icon2=document.getElementById('reg-avatar-icon');
    var img2=document.getElementById('reg-avatar-img');
    if(icon2) icon2.style.display='';
    if(img2) img2.style.display='none';
    document._regPhotoData='';
  }
}

/* ════════ SCROLL TO TOP ════════ */
window.addEventListener('scroll', function(){
  var btn=document.getElementById('scroll-top-btn');
  if(!btn) return;
  if(window.scrollY > 300) btn.classList.add('visible');
  else btn.classList.remove('visible');
}, {passive:true});

/* ════════ ADMIN COPY PHONE ════════ */
function copyPhone(phone){
  navigator.clipboard.writeText(phone).then(()=>toast('✅ تم نسخ الرقم: '+phone)).catch(()=>toast('📞 '+phone));
}


/* ════════ PWA STARS ════════ */
(function(){
  var bg = document.getElementById('pwa-stars-bg');
  if(!bg) return;
  for(var i=0;i<50;i++){
    var s = document.createElement('div');
    s.style.cssText = 'position:absolute;background:rgba(201,168,76,'+(Math.random()*0.5+0.1)+');'
      +'border-radius:50%;'
      +'width:'+(Math.random()*3+1)+'px;'
      +'height:'+(Math.random()*3+1)+'px;'
      +'top:'+(Math.random()*100)+'%;'
      +'left:'+(Math.random()*100)+'%;'
      +'animation:pulse '+(Math.random()*3+2)+'s infinite;';
    bg.appendChild(s);
  }
})();

/* ════════ PWA ════════ */
var _deferredPrompt = null;
var _pwaInstallPending = false;

// Detect device/browser
var _ua = navigator.userAgent;
var _isIOS = /iphone|ipad|ipod/i.test(_ua);
var _isAndroid = /android/i.test(_ua);
var _isChrome = /chrome/i.test(_ua) && !/edge|opr/i.test(_ua);
var _isSamsungBrowser = /samsungbrowser/i.test(_ua);
var _isSafariOnly = /^((?!chrome|android|crios|fxios).)*safari/i.test(_ua);

// Capture install prompt (Android Chrome & Samsung Browser)
// ══ امسك حدث beforeinstallprompt فوراً ══
window.addEventListener('beforeinstallprompt', function(e){
  e.preventDefault();
  _deferredPrompt = e;
  // لو المستخدم ضغط الزرار قبل ما الـ prompt يجهز — شغّله تلقائياً دلوقتي
  if(_pwaInstallPending){
    _pwaInstallPending = false;
    _doInstall();
  }
});

// تم التثبيت
window.addEventListener('appinstalled', function(){
  _deferredPrompt = null;
  _pwaInstallPending = false;
  showInstallSuccessScreen();
});

// ── الدالة الفعلية للتثبيت ──
function _doInstall(){
  var btn   = document.getElementById('pwa-overlay-btn');
  var txtEl = document.getElementById('pwa-btn-text');
  if(!_deferredPrompt) return;
  if(btn)   btn.disabled = true;
  if(txtEl) txtEl.textContent = 'جاري التثبيت...';
  var p = _deferredPrompt;
  _deferredPrompt = null;
  p.prompt();
  p.userChoice.then(function(r){
    if(r.outcome === 'accepted'){
      localStorage.setItem('pwa_prompt_shown','1');
      showInstallSuccessScreen();
    } else {
      if(btn)   btn.disabled = false;
      if(txtEl) txtEl.textContent = 'حمّل التطبيق الآن';
      _deferredPrompt = p; // أعده عشان يقدر يحاول تاني
    }
  }).catch(function(){
    if(btn)   btn.disabled = false;
    if(txtEl) txtEl.textContent = 'حمّل التطبيق الآن';
  });
}


function showIOSInstructions(){
  var o = document.getElementById('pwa-overlay');
  if(!o) return;
  o.style.display = 'flex';
  o.style.background = 'linear-gradient(160deg,#0a1628 0%,#1a2f5e 45%,#0d3a6e 100%)';
  o.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;color:white;font-family:Cairo,sans-serif;text-align:center;padding:40px;width:100%">' +
    '<div style="font-size:56px;margin-bottom:16px">🍎</div>' +
    '<div style="font-size:22px;font-weight:700;margin-bottom:12px;font-family:Cairo,sans-serif;color:#e8d08a">تثبيت على iOS</div>' +
    '<div style="font-size:14px;color:rgba(255,255,255,.8);line-height:2;margin-bottom:28px">' +
      '١. اضغط على زر <strong style="color:#c9a84c">المشاركة</strong> 📤 أسفل الشاشة<br>' +
      '٢. اختر <strong style="color:#c9a84c">إضافة إلى الشاشة الرئيسية</strong><br>' +
      '٣. اضغط <strong style="color:#c9a84c">إضافة</strong> في الأعلى' +
    '</div>' +
    '<button onclick="var o=document.getElementById(\'pwa-overlay\');if(o)o.style.display=\'none\'" ' +
      'style="background:rgba(201,168,76,.15);border:1px solid rgba(201,168,76,.4);color:#e8d08a;' +
      'padding:12px 32px;border-radius:50px;font-size:14px;font-family:Cairo,sans-serif;cursor:pointer">حسناً</button>' +
  '</div>';
}

function installPWAFromOverlay(){
  // لو مثبّت بالفعل
  if(window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone){
    showInstallSuccessScreen(); return;
  }

  // ── iOS / Safari → تعليمات يدوية ──
  if(/iphone|ipad|ipod/i.test(navigator.userAgent) ||
     (/safari/i.test(navigator.userAgent) && !/chrome|android|crios/i.test(navigator.userAgent))){
    showIOSInstructions(); return;
  }

  // ── الـ prompt جاهز → شغّله فوراً ──
  if(_deferredPrompt){
    _doInstall(); return;
  }

  // ── الـ prompt مش جاهز بعد → انتظر (يجيب نفسه لما يجي) ──
  _pwaInstallPending = true;
  var btn   = document.getElementById('pwa-overlay-btn');
  var txtEl = document.getElementById('pwa-btn-text');
  if(btn)   btn.disabled = true;
  if(txtEl) txtEl.textContent = '⏳ جاري التحضير...';

  // لو بعد 8 ثواني ما جاش الـ prompt → اعرض تعليمات يدوية
  setTimeout(function(){
    if(!_pwaInstallPending) return; // تم التثبيت خلال الانتظار
    _pwaInstallPending = false;
    if(btn)   btn.disabled = false;
    if(txtEl) txtEl.textContent = 'حمّل التطبيق الآن';
    // تعليمات Chrome يدوية
    var o = document.getElementById('pwa-overlay');
    if(!o) return;
    o.innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;color:white;font-family:Cairo,sans-serif;text-align:center;padding:32px;width:100%;background:linear-gradient(160deg,#0a1628 0%,#1a2f5e 45%,#0d3a6e 100%)">'
      +'<img src="/icon-192.png" style="width:90px;height:90px;border-radius:20px;margin-bottom:20px;box-shadow:0 8px 24px rgba(0,0,0,.4)">'
      +'<div style="font-size:22px;font-weight:700;color:#e8d08a;margin-bottom:6px">تثبيت ديار</div>'
      +'<div style="width:50px;height:2px;background:linear-gradient(90deg,transparent,#c9a84c,transparent);margin:8px auto 20px"></div>'
      +'<div style="background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.25);border-radius:16px;padding:18px 20px;margin-bottom:24px;text-align:right;width:100%;max-width:320px">'
        +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><span style="font-size:22px">1️⃣</span><span style="font-size:13px;line-height:1.6">اضغط <strong style="color:#e8d08a">⋮ القائمة</strong> في Chrome</span></div>'
        +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><span style="font-size:22px">2️⃣</span><span style="font-size:13px;line-height:1.6">اختر <strong style="color:#e8d08a">إضافة إلى الشاشة الرئيسية</strong></span></div>'
        +'<div style="display:flex;align-items:center;gap:10px"><span style="font-size:22px">3️⃣</span><span style="font-size:13px;line-height:1.6">اضغط <strong style="color:#e8d08a">إضافة</strong> ✅</span></div>'
      +'</div>'
      +'<button onclick="location.reload()" style="background:linear-gradient(135deg,#c9a84c,#e8d08a);color:#0a1628;border:none;padding:14px 32px;border-radius:50px;font-family:Cairo,sans-serif;font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 4px 16px rgba(201,168,76,.35)">🔄 حاول مرة أخرى</button>'
    +'</div>';
  }, 8000);
}

// اكشف الجهاز وحدّث الـ hint تلقائياً
(function detectDevice(){
  var hint = document.getElementById('pwa-device-hint');
  if(!hint) return;
  if(/iphone|ipad|ipod/i.test(navigator.userAgent)) hint.textContent = '📱 iPhone: افتح في Safari للتثبيت';
  else if(/android/i.test(navigator.userAgent)) hint.textContent = '🤖 Android: افتح في Chrome للتثبيت';
  else hint.textContent = '';
})();
function showLoginAfterPWA(){ showInstallSuccessScreen(); }

function showInstallSuccessScreen(){
  var o = document.getElementById('pwa-overlay');
  if(!o) return;
  o.style.display = 'flex';
  o.style.background = 'linear-gradient(160deg,#0a1628 0%,#1a2f5e 45%,#0d3a6e 100%)';
  o.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;color:white;font-family:Cairo,sans-serif;text-align:center;padding:40px;width:100%">' +
    '<div style="font-size:80px;margin-bottom:20px;animation:bounceIn .6s ease">🎉</div>' +
    '<div style="width:60px;height:2px;background:linear-gradient(90deg,transparent,#c9a84c,transparent);margin:0 auto 20px;border-radius:2px"></div>' +
    '<div style="font-size:28px;font-weight:700;margin-bottom:10px;font-family:Playfair Display,serif;color:#e8d08a">تم التثبيت بنجاح!</div>' +
    '<div style="font-size:15px;color:rgba(255,255,255,.75);line-height:1.8;margin-bottom:36px">تطبيق ديار جاهز على شاشتك الرئيسية<br>افتحه من هناك للتجربة الكاملة</div>' +
    '<div style="display:flex;flex-direction:column;gap:12px;width:100%;max-width:320px">' +
      '<div style="background:rgba(201,168,76,.15);border:1px solid rgba(201,168,76,.35);border-radius:16px;padding:16px;display:flex;align-items:center;gap:14px">' +
        '<span style="font-size:28px">📱</span>' +
        '<div style="text-align:right"><div style="font-weight:800;font-size:14px;color:#e8d08a">افتح من الشاشة الرئيسية</div><div style="font-size:12px;color:rgba(255,255,255,.6)">للحصول على أفضل تجربة</div></div>' +
      '</div>' +
      '<div style="background:rgba(201,168,76,.15);border:1px solid rgba(201,168,76,.35);border-radius:16px;padding:16px;display:flex;align-items:center;gap:14px">' +
        '<span style="font-size:28px">🚀</span>' +
        '<div style="text-align:right"><div style="font-weight:800;font-size:14px;color:#e8d08a">يعمل بدون إنترنت</div><div style="font-size:12px;color:rgba(255,255,255,.6)">بعد أول تشغيل</div></div>' +
      '</div>' +
    '</div>' +
    '<div style="font-size:11px;color:rgba(255,255,255,.35);margin-top:40px">✦ ديار — مطروح والساحل الشمالي ✦</div>' +
  '</div>';
}

function installPWA(){
  if(!_deferredPrompt){
    toast('افتح الموقع من المتصفح عشان تحمل التطبيق');
    return;
  }
  _deferredPrompt.prompt();
  _deferredPrompt.userChoice.then(function(r){
    if(r.outcome === 'accepted'){
      toast('🎉 جاري تحميل التطبيق!');
      var wrap = document.getElementById('pwa-install-wrap');
      if(wrap) wrap.style.display = 'none';
    }
    _deferredPrompt = null;
  });
}

// appinstalled handled above

// Register Service Worker


/* ════════ CLOUDINARY UPLOAD ════════ */
async function uploadToCloudinary(file, onProgress){
  var resourceType = file.type.startsWith('video/') ? 'video' : 'image';
  var url = 'https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/' + resourceType + '/upload';
  var fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLOUDINARY_PRESET);
  fd.append('folder', 'diyar-matrouh');
  
  return new Promise(function(resolve, reject){
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    
    if(onProgress){
      xhr.upload.addEventListener('progress', function(e){
        if(e.lengthComputable){
          var pct = Math.round((e.loaded / e.total) * 100);
          onProgress(pct);
        }
      });
    }
    
    xhr.onload = function(){
      try{
        var data = JSON.parse(xhr.responseText);
        if(data.secure_url){
          resolve(data.secure_url);
        } else {
          var errMsg = data.error ? data.error.message : 'رفع فاشل';
          reject(new Error(errMsg));
        }
      } catch(e){ reject(new Error('خطأ في استجابة السيرفر')); }
    };
    xhr.onerror = function(){ reject(new Error('فشل الاتصال بالإنترنت')); };
    xhr.ontimeout = function(){ reject(new Error('انتهت مهلة الرفع، حاول مرة أخرى')); };
    xhr.timeout = 120000; // 2 minutes
    xhr.send(fd);
  });
}

async function uploadAllPhotosToCloudinary(files, onProgress){
  var urls = [];
  for(var i = 0; i < files.length; i++){
    var fileProgress = (function(idx, total){
      return function(pct){
        var overall = Math.round(((idx + pct/100) / total) * 100);
        if(onProgress) onProgress(overall, idx+1, total);
      };
    })(i, files.length);
    try{
      var url = await uploadToCloudinary(files[i], fileProgress);
      if(url) urls.push(url);
    } catch(e){
      throw new Error('فشل رفع الصورة ' + (i+1) + ': ' + (e.message||'خطأ غير معروف'));
    }
  }
  return urls;
}

/* ════════ OFFLINE DETECTION ════════ */
function showOffline(){
  var el = document.getElementById('offline-overlay');
  if(!el) return;
  el.style.display = 'flex';
  // تهيئة النجوم
  var bg = document.getElementById('offline-stars');
  if(bg && !bg._init){
    bg._init = true;
    for(var i=0;i<40;i++){
      var s=document.createElement('div');
      s.style.cssText='position:absolute;background:rgba(201,168,76,'+(Math.random()*.4+.1)+');border-radius:50%;'
        +'width:'+(Math.random()*2.5+1)+'px;height:'+(Math.random()*2.5+1)+'px;'
        +'top:'+(Math.random()*100)+'%;left:'+(Math.random()*100)+'%;'
        +'animation:pulse '+(Math.random()*3+2)+'s infinite';
      bg.appendChild(s);
    }
  }
}
function hideOffline(){
  var el = document.getElementById('offline-overlay');
  if(el) el.style.display = 'none';
}
function retryConnection(){
  var btn = document.querySelector('#offline-overlay button');
  if(btn){ btn.textContent='⏳ جاري التحقق...'; btn.disabled=true; }
  setTimeout(function(){
    if(navigator.onLine){
      hideOffline();
      toast('✅ عاد الاتصال بالإنترنت!');
    } else {
      if(btn){ btn.textContent='🔄 إعادة المحاولة'; btn.disabled=false; }
      toast('⚠️ لا يزال لا يوجد اتصال');
    }
  }, 1500);
}
window.addEventListener('online', function(){
  hideOffline();
  toast('✅ عاد الاتصال بالإنترنت!');
});
window.addEventListener('offline', function(){ showOffline(); });

/* ════════ SW AUTO UPDATE ════════ */
if('serviceWorker' in navigator){
  navigator.serviceWorker.addEventListener('controllerchange', function(){
    toast('🔄 جاري تحديث التطبيق...');
    setTimeout(function(){ window.location.reload(); }, 1500);
  });
  navigator.serviceWorker.register('/sw.js').then(function(reg){
    setInterval(function(){ reg.update(); }, 30000);
    reg.addEventListener('updatefound', function(){
      var nw = reg.installing;
      if(!nw) return;
      nw.addEventListener('statechange', function(){
        if(nw.state==='installed' && navigator.serviceWorker.controller){
          nw.postMessage({type:'SKIP_WAITING'});
        }
      });
    });
  }).catch(function(){});
}


/* ════════ SMART TOASTS ════════ */
function showSmartToast(icon, title, sub, type, duration){
  type = type || 'info';
  duration = duration || 4500;
  var container = document.getElementById('smart-toast-container');
  if(!container) return;
  var el = document.createElement('div');
  el.className = 'st-item ' + type;
  el.innerHTML = '<div class="st-icon">'+icon+'</div>'+
    '<div class="st-body"><div class="st-title">'+title+'</div></div>'+
    '<button class="st-close" onclick="this.parentElement.remove()">✕</button>';
  container.appendChild(el);
  setTimeout(function(){ el.classList.add('show'); }, 50);
  setTimeout(function(){
    el.classList.remove('show');
    setTimeout(function(){ if(el.parentElement) el.remove(); }, 400);
  }, duration);
}

var _fakeToasts = [
  {icon:'🏠', title:'شقة جديدة في مارينا', type:'info'},
  {icon:'🔥', title:'إعلان مميز في علم الروم', type:'warning'},
  {icon:'👁️', title:'12 شخص شافوا إعلانك', type:'success'},
  {icon:'⭐', title:'شقة مميزة في الساحل الشمالي', type:'info'},
  {icon:'🏖️', title:'إيجار يومي جديد في مطروح', type:'info'},
  {icon:'💰', title:'عرض خاص في النجيلة', type:'warning'},
  {icon:'🆕', title:'إعلان جديد في الضبعة', type:'info'},
  {icon:'🤝', title:'واحد محتاج شقة في منطقتك', type:'success'},
  {icon:'📍', title:'أرض جديدة في سيدي عبد الرحمن', type:'info'},
  {icon:'🏡', title:'فيلا للإيجار الشتوي في مارينا', type:'warning'},
  {icon:'💎', title:'شقة سوبر لوكس تمليك', type:'info'},
  {icon:'🌊', title:'شاليه على البحر مباشرة', type:'success'},
  {icon:'🔑', title:'شقة تمليك جديدة في مطروح', type:'info'},
  {icon:'🏪', title:'محل تجاري للإيجار في المدينة', type:'warning'},
  {icon:'🌴', title:'أرض بناء في الساحل الشمالي', type:'info'},
];

var _fakeIdx = 0;
function showNextFakeToast(){
  if(!currentUser) return;
  var t = _fakeToasts[_fakeIdx % _fakeToasts.length];
  _fakeIdx = (_fakeIdx + 1) % _fakeToasts.length;
  showSmartToast(t.icon, t.title, t.sub, t.type, 5000);
}

// تم إلغاء التنبيهات الوهمية


function logoutBroker(){
  if(!confirm('هل تريد تسجيل الخروج؟')) return;
  // احتفظ بالبيانات التي لا علاقة لها بالجلسة
  var savedPhones   = localStorage.getItem('fares_saved_phones');
  var savedDb       = localStorage.getItem('fares_db_cache');
  var savedViews    = localStorage.getItem('fares_views');
  var savedSettings = localStorage.getItem('fares_settings_cache');
  var savedUsers    = localStorage.getItem('fares_users_cache');
  localStorage.clear();
  sessionStorage.clear();
  // أعد البيانات غير المرتبطة بالجلسة
  if(savedPhones)   localStorage.setItem('fares_saved_phones',   savedPhones);
  if(savedDb)       localStorage.setItem('fares_db_cache',       savedDb);
  if(savedViews)    localStorage.setItem('fares_views',          savedViews);
  if(savedSettings) localStorage.setItem('fares_settings_cache', savedSettings);
  if(savedUsers)    localStorage.setItem('fares_users_cache',     savedUsers);
  // تصفير الحالة في الذاكرة فقط (ليس الـ DB cache)
  currentUser = null;
  uploadedPhotos = [];
  _usersCache = null;
  _settingsCache = null;
  // لا نصفّر _dbCache ولا _dbCacheTime — نبقيهم عشان الدخول التالي يجد الإعلانات فوراً
  document.getElementById('user-badge-wrap').style.display = 'none';
  document.getElementById('broker-home-card').style.display = 'none';
  document.getElementById('visitor-choices').style.display = 'block';
  var _aloLB=document.getElementById('otp-overlay'); if(_aloLB) _aloLB.style.display='flex';
  loadSavedPhones();
  toast('👋 تم تسجيل الخروج بأمان');
}


function togglePasswordVisible(){
  var inp = document.getElementById('otp-password');
  if(!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
}


/* ════════ ADMIN ACTIONS IN LISTINGS ════════ */
async function adminDeleteAdFromListing(id){
  if(!confirm('حذف هذا الإعلان؟')) return;
  await deleteAd(id); // deleteAd تعرض رسالة الحذف وتُحدّث لوحة الأدمن
  // تحديث الـ virtual scroll بعد الحذف
  _vsAllAds = _vsAllAds.filter(function(a){ return a.id !== id; });
  var grid = document.getElementById('listings-grid');
  if(grid){
    if(_vsAllAds.length){
      renderVirtualBatch(grid, true);
    } else {
      grid.innerHTML = '<div class="no-listings"><div class="nl-ico">🔍</div><div style="font-weight:700;font-size:16px;color:#1a2744">لا توجد إعلانات</div></div>';
    }
  }
}

function adminToggleFeaturedFromListing(id){
  var db = loadDB();
  var ad = (db.approved||[]).find(a=>a.id===id);
  if(!ad) return;
  ad.featured = !ad.featured;
  saveDB(db);
  saveAdToSB(ad, 'approved').catch(function(){});
  showListings(_currentListingsCat||'', _listingsSource||'home');
  toast(ad.featured ? '⭐ تم تمييز الإعلان' : '☆ تم إلغاء التمييز');
}

function adminBlockUserFromListing(phone){
  if(!confirm('حظر هذا المستخدم؟ ('+phone+')')) return;
  var users = loadUsers();
  var u = users.find(x=>x.phone===phone);
  if(u){
    u.blocked = true;
    saveUsers(users);
    saveUserToSB(u).catch(function(e){ console.error('adminBlockUserFromListing SB error:', e.message); });
  } else {
    var newU = {phone, blocked:true, joinedAt:''};
    users.push(newU);
    saveUsers(users);
    saveUserToSB(newU).catch(function(e){ console.error('adminBlockUserFromListing SB error:', e.message); });
  }
  toast('🚫 تم حظر المستخدم: '+phone);
}


/* ════════ VERIFICATION SYSTEM ════════ */
function sendVerificationWA(e){
  if(e) e.stopPropagation();
  var profile = loadBrokerProfile();
  if(!profile){ toast('⚠️ أكمل بيانات حسابك أولاً'); return; }
  var s = loadSettings();
  var adminWa = (s.adminWa||ADMIN_NUMBER).replace(/^0/,'20');
  var wallet = s.vodafoneNum || '01005581620';
  var price = s.verifyPrice || '100';
  var msg = '🏅 *طلب توثيق حساب ديار*\n\n'
    +'👤 الاسم: '+(profile.name||'')+'\n'
    +'📱 رقم الحساب: '+(profile.phone||'')+'\n'
    +'🏷️ النوع: '+(profile.accountType||'')+'\n\n'
    +'💰 تم تحويل '+price+' ج.م\n'
    +'📲 على رقم: '+wallet+'\n\n'
    +'📎 إيصال التحويل مرفق 👆';
  window.open('https://wa.me/'+adminWa+'?text='+encodeURIComponent(msg),'_blank');
}

function showVerifyCard(e){
  if(e) e.stopPropagation();
  var s = loadSettings();
  var vc_price = document.getElementById('vc-price');
  var vc_num   = document.getElementById('vc-number');
  if(vc_price) vc_price.textContent = s.verifyPrice || '100';
  if(vc_num)   vc_num.textContent   = s.vodafoneNum || '01005581620';
  var ov = document.getElementById('verify-card-overlay');
  if(ov){ ov.style.display='flex'; }
}
function closeVerifyCard(){
  var ov = document.getElementById('verify-card-overlay');
  if(ov) ov.style.display='none';
}
function copyVerifyNum(){
  var el = document.getElementById('vc-number');
  if(!el) return;
  var num = el.textContent.trim();
  if(navigator.clipboard){
    navigator.clipboard.writeText(num).then(function(){ toast('✅ تم نسخ الرقم: '+num); });
  } else {
    var t=document.createElement('textarea'); t.value=num;
    document.body.appendChild(t); t.select(); document.execCommand('copy');
    document.body.removeChild(t); toast('✅ تم نسخ الرقم');
  }
}
function reportProblem(){
  var s = loadSettings();
  var adminWa = (s.adminWa||ADMIN_NUMBER).replace(/^0/,'20');
  var profile = loadBrokerProfile();
  var msg = '🚨 *إبلاغ عن مشكلة — تطبيق ديار*\n\n';
  if(profile){ msg += '👤 '+profile.name+'\n📱 '+profile.phone+'\n\n'; }
  msg += 'المشكلة: ';
  window.open('https://wa.me/'+adminWa+'?text='+encodeURIComponent(msg),'_blank');
}

async function deleteMyAccount(){
  if(!confirm('هل أنت متأكد من حذف حسابك نهائياً؟ لا يمكن التراجع عن هذا الإجراء!')) return;
  if(!confirm('تأكيد أخير: سيتم حذف جميع بياناتك وإعلاناتك!')) return;
  var phone = currentUser ? currentUser.phone : null;
  if(phone){
    // جيب أحدث البيانات من Supabase قبل الحذف
    try{ await loadDBAsync(true); } catch(e){}
    // حذف إعلانات المستخدم من Supabase
    var db = loadDB();
    var myAds = [...(db.approved||[]), ...(db.pending||[])].filter(function(a){
      return a.phone === phone || a.submitterPhone === phone;
    });
    myAds.forEach(function(a){
      deleteAdFromSB(a.id).catch(function(){});
    });
    // حذف المستخدم نفسه من Supabase
    await fetch(SUPABASE_URL + '/rest/v1/users?phone=eq.'+encodeURIComponent(phone), {
      method: 'DELETE',
      headers: {'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY}
    }).catch(function(e){ console.error('deleteMyAccount user SB error:', e.message); });
  }
  localStorage.clear();
  sessionStorage.clear();
  currentUser = null;
  _dbCache = null;
  _dbCacheTime = 0;
  _usersCache = null;
  _settingsCache = null;
  toast('✅ تم حذف الحساب');
  setTimeout(function(){ location.reload(); }, 1500);
}

/* ════════ ADMIN LOGOUT ════════ */
function adminLogout(){
  if(!confirm('تسجيل خروج الأدمن؟')) return;
  currentUser = null;
  localStorage.removeItem('fares_current_user');
  var _alf=document.getElementById('admin-fab'); if(_alf) _alf.style.display='none';
  closeAdmin();
  var _aloAL=document.getElementById('otp-overlay'); if(_aloAL) _aloAL.style.display='flex';
  loadSavedPhones();
  toast('👋 تم تسجيل خروج الأدمن');
}

/* ════════ BROKERS PANEL ════════ */
async function renderBrokersPanel(){
  var el = document.getElementById('brokers-list');
  if(!el) return;
  // اعرض loading أولاً
  el.innerHTML = '<div style="text-align:center;padding:40px;color:#8a9ab8"><div style="font-size:32px;margin-bottom:10px">⏳</div><div style="font-size:13px;font-weight:700">جاري تحميل بيانات السماسرة...</div></div>';
  // جيب أحدث البيانات من Supabase
  try{ await loadUsersAsync(); } catch(e){}
  var users = loadUsers();
  var db = loadDB();
  // ابحث في الإعلانات عن سماسرة/ملاك غير مسجلين في users
  var phonesInAds = {};
  [...(db.approved||[]), ...(db.pending||[])].forEach(function(ad){
    var phone = ad.submitterPhone || ad.phone;
    if(phone && !phonesInAds[phone]){
      phonesInAds[phone] = {
        phone: phone,
        profile_name: ad.ownerName || phone,
        profile_type: ad.brokerType || 'مالك',
        profile_phone: phone,
        profile_photo: ad.brokerPhoto || '',
        _fromAds: true
      };
    }
  });
  var brokers = users.filter(function(u){ return u.profile_type; });
  // أضف من الإعلانات من مش موجود في users
  Object.keys(phonesInAds).forEach(function(phone){
    var exists = brokers.find(function(b){ return b.phone === phone; });
    if(!exists) brokers.push(phonesInAds[phone]);
  });

  if(!brokers.length){
    el.innerHTML = '<div class="empty-admin">🏢 لا يوجد سماسرة أو ملاك مسجلون بعد</div>';
    return;
  }
  
  el.innerHTML = '<div class="sec-header"><div class="sec-header-title">🏢 السماسرة والملاك <span class="sec-badge sec-badge-green">'+brokers.length+'</span></div></div>' +
    brokers.map(function(u){
      var isVerified = !!u.verified;
      var isBlocked = !!u.blocked;
      var typeClass = u.profile_type === 'سمسار' ? 'broker-type-samsar' : 'broker-type-owner';
      var avatarHtml = u.profile_photo
        ? '<img src="'+u.profile_photo+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
        : (u.profile_type==='سمسار'?'🤝':'🏠');
      return '<div class="broker-row">'+
        '<div class="broker-avatar">'+avatarHtml+'</div>'+
        '<div class="broker-info">'+
          '<div class="broker-name">'+(isVerified?'✓ ':'')+u.profile_name+
            (isVerified?'<span class="verified-badge" style="margin-right:4px">موثق</span>':'')+
          '</div>'+
          '<div class="broker-phone">📞 '+(u.profile_phone||u.phone)+'</div>'+
          '<span class="broker-type '+typeClass+'">'+(u.profile_type||'مستخدم')+'</span>'+
          (isBlocked?'<span style="font-size:10px;color:#dc2626;margin-right:6px">🚫 محظور</span>':'')+
        '</div>'+
                '<div class="broker-actions">'+
          '<button class="bk-btn bk-verify" onclick="adminVerifyBroker(this.dataset.phone)" data-phone="'+u.phone+'">'+(isVerified?'✓ موثق':'توثيق')+'</button>'+
          '<button class="bk-btn bk-block" onclick="toggleBlockUser(this.dataset.phone)" data-phone="'+u.phone+'">'+(isBlocked?'رفع حظر':'حظر')+'</button>'+
          '<button class="bk-btn bk-del" onclick="adminDeleteBroker(this.dataset.phone)" data-phone="'+u.phone+'">'+'حذف'+'</button>'+
        '</div>'+
      '</div>';
    }).join('');
}

function adminVerifyBroker(phone){
  // phone is always a string (passed from onclick via data-phone attribute)
  if(!phone || typeof phone !== 'string'){ toast('⚠️ خطأ في بيانات المستخدم'); return; }
  var users = loadUsers();
  var u = users.find(function(x){ return x.phone===phone; });
  if(!u){ toast('⚠️ مستخدم غير موجود'); return; }
  u.verified = !u.verified;
  saveUsers(users);
  saveUserToSB(u);
  renderBrokersPanel();
  toast(u.verified ? '✅ تم توثيق الحساب' : '☆ تم إلغاء التوثيق');
}

function adminDeleteBroker(phone){
  // phone is always a string (passed from onclick via data-phone attribute)
  if(!phone || typeof phone !== 'string'){ toast('⚠️ خطأ في بيانات المستخدم'); return; }
  if(!confirm('حذف هذا الحساب نهائياً؟')) return;
  var users = loadUsers();
  users = users.filter(function(u){ return u.phone !== phone; });
  saveUsers(users);
  // حذف المستخدم من Supabase
  fetch(SUPABASE_URL + '/rest/v1/users?phone=eq.'+encodeURIComponent(phone), {
    method: 'DELETE',
    headers: {'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY}
  }).catch(function(e){ console.error('adminDeleteBroker user SB error:', e.message); });
  // حذف إعلاناته من الـ cache وSupabase
  var db = loadDB();
  var toDelete = (db.approved||[]).concat(db.pending||[]).filter(function(a){ return a.phone===phone || a.submitterPhone===phone; });
  db.approved = (db.approved||[]).filter(function(a){ return a.phone!==phone && a.submitterPhone!==phone; });
  db.pending = (db.pending||[]).filter(function(a){ return a.phone!==phone && a.submitterPhone!==phone; });
  saveDB(db);
  toDelete.forEach(function(a){ deleteAdFromSB(a.id).catch(function(){}); });
  renderBrokersPanel();
  toast('🗑️ تم حذف الحساب وإعلاناته');
}

/* ════════ HARD LOGOUT (session reset) ════════ */
function hardLogout(){
  if(!confirm('مسح كل البيانات وإعادة التشغيل؟')) return;
  localStorage.clear();
  sessionStorage.clear();
  currentUser = null;
  location.reload();
}


/* ══ UI LOCKING: Prevent horizontal scroll & pinch zoom ══ */
document.addEventListener('touchmove', function(e){
  if(e.touches.length > 1){ e.preventDefault(); } // block pinch zoom
}, {passive: false});

var lastTouchEnd = 0;
document.addEventListener('touchend', function(e){
  var now = Date.now();
  if(now - lastTouchEnd < 300){ e.preventDefault(); } // block double-tap zoom
  lastTouchEnd = now;
}, false);

// Prevent horizontal overscroll
document.body.addEventListener('touchmove', function(e){
  if(Math.abs(e.touches[0].clientX - (e.touches[0].pageX||0)) > 10){
    // horizontal intent - allow but clamp
  }
}, {passive: true});

/* ════════ REAL SEA CONDITION (Open-Meteo) ════════ */
async function fetchSeaCondition(){
  try{
    // مطروح coordinates: lat=31.35, lon=27.23
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=31.35&longitude=27.23&current=wind_speed_10m,wave_height,weather_code,temperature_2m&wind_speed_unit=ms';
    var res = await fetch(url);
    var data = await res.json();
    var c = data.current;
    var waveH = c.wave_height || 0;
    var windSpd = c.wind_speed_10m || 0;
    var temp = Math.round(c.temperature_2m || 0);

    var seaText, dotColor, dotClass;

    // تحديد حالة البحر بناءً على ارتفاع الموج والرياح
    if(waveH < 0.5 && windSpd < 5){
      seaText = '🌊 البحر هادئ — مثالي للسباحة 🏊';
      dotColor = '#5efa9b'; dotClass = 'calm';
    } else if(waveH < 1.0 && windSpd < 8){
      seaText = '🌊 البحر خفيف — مناسب للسباحة';
      dotColor = '#5efa9b'; dotClass = 'calm';
    } else if(waveH < 1.5 && windSpd < 12){
      seaText = '🌊 البحر متوسط — السباحة بحذر';
      dotColor = '#fbbf24'; dotClass = 'moderate';
    } else {
      seaText = '⚠️ البحر متلاطم — يُنصح بالابتعاد';
      dotColor = '#ef4444'; dotClass = 'rough';
    }

    // أضف درجة الحرارة
    seaText += ' · ' + temp + '°';

    var textEl = document.getElementById('sea-condition-text');
    var dotEl = document.getElementById('sea-dot');
    if(textEl) textEl.textContent = seaText;
    if(dotEl) dotEl.style.background = dotColor;
  } catch(e){
    var textEl = document.getElementById('sea-condition-text');
    if(textEl) textEl.textContent = '🌊 البحر اليوم: بيانات غير متاحة';
  }
}

// شغّل عند التحميل وكل 15 دقيقة
document.addEventListener('DOMContentLoaded', function(){
  fetchSeaCondition();
  setInterval(fetchSeaCondition, 15 * 60 * 1000);
  // ملاحظة: تهيئة قاعدة البيانات تتم في window.load لتجنب التهيئة المزدوجة
});

/* ════════ SUPABASE REALTIME SYNC ════════ */
var _lastSyncAt = null;
var _realtimeInterval = null;

async function startRealtimeSync(){
  if(_realtimeInterval) clearInterval(_realtimeInterval);
  _realtimeInterval = setInterval(async function(){
    if(!navigator.onLine) return;
    try{
      // فحص سريع — جيب آخر updated_at بس (لا تجيب كل البيانات)
      var controller = new AbortController();
      var timer = setTimeout(function(){ controller.abort(); }, 8000); // timeout أقصر للـ check
      var res, rows;
      try{
        res = await fetch(SUPABASE_URL + '/rest/v1/ads?select=id,updated_at,status&order=updated_at.desc&limit=1', {
          signal: controller.signal,
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
        });
        rows = res.ok ? await res.json() : [];
      } finally { clearTimeout(timer); }

      if(!rows || !rows.length) return;
      var latestSB = rows[0].updated_at;
      if(_lastSyncAt && latestSB > _lastSyncAt){
        // في تحديث جديد — جيب كل البيانات
        await loadDBAsync(true);
        _lastSyncAt = latestSB;
        // حدّث الـ UI لو ظاهر
        if(document.getElementById('s-listings') && 
           document.getElementById('s-listings').classList.contains('active')){
          renderListings(_currentListingsCat||'');
        }
        updateNotifDot();
        updateMyAdsCard();
        var _ms=document.getElementById('s-myads'); if(_ms&&_ms.classList.contains('active')) _doRenderMyAds();
        var _ao=document.getElementById('admin-overlay'); if(_ao&&!_ao.classList.contains('hidden')) renderAdminPanel();
      } else if(!_lastSyncAt){
        _lastSyncAt = latestSB;
      }
    } catch(e){}
  }, 30000); // كل 30 ثانية
}

/* ════════ PROPERTY DETAIL MODAL ════════ */
var _currentModalImgIdx = 0;
var _currentModalAd = null;

function openPropModal(id){
  var db = loadDB();
  var ad = (db.approved||[]).find(function(a){ return a.id===id; });
  if(!ad){ toast('⚠️ الإعلان غير موجود'); return; }
  _currentModalAd = ad;
  _currentModalImgIdx = 0;
  recordView(id);
  renderPropModal(ad);
  var ov = document.getElementById('prop-modal-overlay');
  if(ov){ ov.style.display='flex'; setTimeout(function(){ ov.classList.add('open'); },10); }
  _lockScroll();
}

function closePropModal(e){
  if(e && e.target !== document.getElementById('prop-modal-overlay')) return;
  var ov = document.getElementById('prop-modal-overlay');
  if(ov){ ov.classList.remove('open'); setTimeout(function(){ ov.style.display='none'; },300); }
  _unlockScroll();
}
function closePropModalBtn(){
  var ov = document.getElementById('prop-modal-overlay');
  if(ov){ ov.classList.remove('open'); setTimeout(function(){ ov.style.display='none'; },300); }
  _unlockScroll();
}

function renderPropModal(ad){
  var pl={apt:'شقة / بيت',land:'أرض',shop:'محل'};
  var pe={apt:'🏠',land:'🌍',shop:'🏪'};
  var lm={water:'💧 مياه',gas:'🔥 غاز',elec:'⚡ كهرباء',sewage:'🚰 صرف صحي',
          elev:'🛗 أسانسير',park:'🚗 جراج',sec:'🔒 أمن',seaview:'🌊 إطلالة بحر',
          furn:'🛋 مفروشة',ac:'❄️ تكييف',pool:'🏊 حمام سباحة',gym:'💪 جيم'};
  var pLabel = (pl[ad.propType]||'عقار');
  var photos = ad.photos&&ad.photos.length ? ad.photos : [];
  var viewCount = getViews(ad.id);

  // Images section
  var imgsHtml;
  if(photos.length){
    imgsHtml = '<div class="prop-modal-imgs" id="modal-imgs-wrap">'+
      '<img id="modal-main-img" src="'+photos[0]+'" alt="صورة">'+
      '<button class="prop-modal-close" onclick="closePropModalBtn()">✕</button>'+
      (photos.length>1?
        '<div class="prop-modal-imgs-count" id="modal-img-count">1 / '+photos.length+'</div>'+
        '<div class="prop-modal-imgs-nav">'+
          '<button onclick="modalImgNav(-1)">‹</button>'+
          '<button onclick="modalImgNav(1)">›</button>'+
        '</div>':'')+
    '</div>';
  } else {
    imgsHtml = '<div class="prop-modal-imgs" style="display:flex;align-items:center;justify-content:center;font-size:72px;background:linear-gradient(135deg,#e8e2d4,#f5f2ea)">'+
      '<button class="prop-modal-close" onclick="closePropModalBtn()">✕</button>'+
      (pe[ad.propType]||'🏠')+
    '</div>';
  }

  // Badges
  var dealBdg = ad.dealType==='sale'
    ?'<span class="prop-modal-badge pmb-sale">🔑 تمليك</span>'
    :'<span class="prop-modal-badge pmb-rent">🗓️ '+(ad.rentType||'إيجار')+'</span>';
  var featBdg = ad.featured?'<span class="prop-modal-badge pmb-feat">⭐ مميز</span>':'';
  var isNew = false;
  try{ var t=new Date(ad.submitted_ts||ad.submittedAt); isNew=(Date.now()-t.getTime())<48*3600*1000 && !isNaN(t.getTime()); }catch(e){}
  var newBdg = isNew?'<span class="prop-modal-badge pmb-new">✨ جديد</span>':'';

  // Details grid
  var details = [];
  if(ad.propType) details.push({l:'النوع', v: pLabel});
  if(ad.region)   details.push({l:'المنطقة', v:'📍 '+ad.region});
  if(ad.size)     details.push({l: ad.propType==='apt'?'الغرف':'المساحة', v: ad.propType==='apt'?'🛏 '+ad.size+' غرف':'📐 '+ad.size+' م²'});
  if(ad.aptArea)  details.push({l:'المساحة', v:'📐 '+ad.aptArea+' م²'});
  if(ad.floor)    details.push({l:'الدور', v:'🏢 '+ad.floor});
  if(ad.nearSea)  details.push({l:'قرب البحر', v:'🌊 '+ad.nearSea});
  if(ad.finishVal) details.push({l:'التشطيب', v:'🎨 '+ad.finishVal});
  if(ad.aptFurnish) details.push({l:'الفرش', v:'🛋 '+ad.aptFurnish});
  if(ad.aptPayment) details.push({l:'الدفع', v:'💳 '+ad.aptPayment});
  if(ad.shopPayment) details.push({l:'دفع المحل', v:'💳 '+ad.shopPayment});
  if(ad.adCode)   details.push({l:'كود الإعلان', v:'#'+ad.adCode});
  if(viewCount>0) details.push({l:'المشاهدات', v:'👁️ '+viewCount});
  if(ad.submittedAt) details.push({l:'تاريخ النشر', v:'📅 '+ad.submittedAt});

  var detailsHtml = details.map(function(d){
    return '<div class="prop-modal-item"><div class="prop-modal-item-label">'+d.l+'</div><div class="prop-modal-item-value">'+d.v+'</div></div>';
  }).join('');

  // Services
  var servicesHtml = '';
  if(ad.services&&ad.services.length){
    servicesHtml = '<div class="prop-modal-section">'+
      '<div class="prop-modal-section-title">المرافق والخدمات</div>'+
      '<div class="prop-modal-services">'+
        ad.services.map(function(s){ return '<span class="prop-modal-service">'+(lm[s]||s)+'</span>'; }).join('')+
      '</div></div>';
  }

  // Broker card
  var users = loadUsers();
  var brokerUser = users.find(function(u){ return u.phone===ad.phone || u.phone===ad.submitterPhone; });
  var isVerified = brokerUser && brokerUser.verified;
  var bName  = ad.ownerName || '—';
  var bType  = ad.brokerType || (brokerUser&&brokerUser.profile_type) || '';
  var bPhone = ad.phone || '';
  var bPhoto = ad.brokerPhoto || (brokerUser&&brokerUser.profile_photo) || '';
  var sBName  = escapeHTML(bName);
  var sBType  = escapeHTML(bType);
  var sBPhone = escapeHTML(bPhone);
  var avatarInner = bPhoto
    ? '<img src="'+escapeHTML(bPhoto)+'">'
    : (bType==='سمسار'?'🤝':'🏠');
  var verifiedBadge = isVerified?'<span class="prop-broker-verified">✓ موثق</span>':'';

  var brokerHtml = '<div class="prop-modal-section">'+
    '<div class="prop-modal-section-title">المعلن</div>'+
    '<div class="prop-broker-card" onclick="openBrokerAds(\''+sBPhone+'\',\''+encodeURIComponent(sBName)+'\')">' +
      '<div class="prop-broker-avatar">'+avatarInner+'</div>'+
      '<div class="prop-broker-info">'+
        '<div class="prop-broker-name">'+sBName+'</div>'+
        (bType?'<div class="prop-broker-type">'+sBType+'</div>':'')+
        (bPhone?'<div class="prop-broker-phone">📞 '+sBPhone+'</div>':'')+
        verifiedBadge+
      '</div>'+
      '<div style="color:rgba(255,255,255,.4);font-size:20px">‹</div>'+
    '</div>'+
    '<button class="prop-action-broker-ads" onclick="openBrokerAds(\''+sBPhone+'\',\''+encodeURIComponent(sBName)+'\')" >'+
      '🏘️ عرض جميع عقارات '+sBName+
    '</button>'+
  '</div>';

  // Actions
  var waIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="18" height="18"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';
  var actionsHtml = '<div class="prop-modal-actions">'+
    '<button class="prop-action-wa" onclick="contactOwnerModal(\''+sBPhone+'\',\''+escapeHTML(ad.id)+'\')">'+waIcon+' واتساب</button>'+
    '<button class="prop-action-call" onclick="window.open(\'tel:'+sBPhone+'\')">📞 اتصال</button>'+
  '</div>';

  var html = imgsHtml +
    '<div class="prop-modal-body">'+
      // Header: title + price + badges
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px">'+
        '<div style="flex:1">'+
          '<div class="prop-modal-title">'+pLabel+' · '+escapeHTML(ad.region)+'</div>'+
          '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px">'+dealBdg+featBdg+newBdg+'</div>'+
        '</div>'+
        '<div style="text-align:left;flex-shrink:0;background:#fffbeb;border:1.5px solid #fcd34d;border-radius:12px;padding:8px 12px">'+
          '<div style="font-size:10px;color:#92400e;font-weight:700">السعر</div>'+
          '<div class="prop-modal-price" style="font-size:19px">'+Number(ad.price).toLocaleString('ar-EG')+'</div>'+
          '<div style="font-size:10px;color:#8a9ab8;font-weight:600">ج.م</div>'+
        '</div>'+
      '</div>'+
      // Actions first (easy to reach)
      actionsHtml+
      // Broker
      brokerHtml+
      // Details
      '<div class="prop-modal-section">'+
        '<div class="prop-modal-section-title">تفاصيل العقار</div>'+
        '<div class="prop-modal-grid">'+detailsHtml+'</div>'+
      '</div>'+
      (ad.desc?'<div class="prop-modal-section"><div class="prop-modal-section-title">الوصف</div><div class="prop-modal-desc">'+escapeHTML(ad.desc)+'</div></div>':'')+
      servicesHtml+
    '</div>';

  var mc = document.getElementById('prop-modal-content');
  if(mc) mc.innerHTML = html;
}

function modalImgNav(dir){
  if(!_currentModalAd || !_currentModalAd.photos) return;
  var photos = _currentModalAd.photos;
  _currentModalImgIdx = (_currentModalImgIdx + dir + photos.length) % photos.length;
  var img = document.getElementById('modal-main-img');
  var cnt = document.getElementById('modal-img-count');
  if(img) img.src = photos[_currentModalImgIdx];
  if(cnt) cnt.textContent = (_currentModalImgIdx+1)+' / '+photos.length;
}

function contactOwnerModal(phone, id){
  var db=loadDB(); var ad=(db.approved||[]).find(function(a){ return a.id===id; });
  var clean=phone.replace(/\s/g,'').replace(/^0/,'20');
  var pl={apt:'شقة / بيت',land:'أرض',shop:'محل'};
  var msg='مرحبا 👋\nشفت إعلانك على موقع *ديار* 🏠\n';
  if(ad){
    msg+='📌 '+(pl[ad.propType]||'عقار')+' في '+(ad.region||'')+'\n';
    msg+='💰 '+Number(ad.price).toLocaleString('ar-EG')+' ج.م\n';
    if(ad.adCode) msg+='🔖 كود: #'+ad.adCode+'\n';
  }
  msg+='هل هو متاح؟';
  window.open('https://wa.me/'+clean+'?text='+encodeURIComponent(msg),'_blank');
}

/* ════════ BROKER ADS MODAL ════════ */
function openBrokerAds(phone, name){
  name = decodeURIComponent(name);
  var db = loadDB();
  var brokerAds = (db.approved||[]).filter(function(a){
    return a.phone===phone || a.submitterPhone===phone;
  });
  var users = loadUsers();
  var brokerUser = users.find(function(u){ return u.phone===phone || u.profile_phone===phone; });
  var isVerified = brokerUser && brokerUser.verified;
  var bPhoto = brokerUser&&brokerUser.profile_photo ? brokerUser.profile_photo : '';
  var bType = brokerUser&&brokerUser.profile_type ? brokerUser.profile_type : '';

  var avatarInner = bPhoto
    ? '<img src="'+bPhoto+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
    : (bType==='سمسار'?'🤝':'🏠');

  var verifiedBadge = isVerified
    ?'<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(201,168,76,.2);border:1px solid rgba(201,168,76,.4);color:#e8d08a;font-size:10px;font-weight:800;padding:2px 8px;border-radius:20px">✓ موثق</span>':'';

  var html = '<div style="position:relative">'+
    '<button onclick="closeBrokerAdsBtn()" style="position:absolute;top:12px;right:12px;width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.15);border:none;cursor:pointer;font-size:16px;color:white;z-index:2">✕</button>'+
    '<div class="broker-ads-header">'+
      '<div style="display:flex;align-items:center;gap:14px">'+
        '<div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#c9a84c,#e8d08a);display:flex;align-items:center;justify-content:center;font-size:24px;overflow:hidden;border:2px solid rgba(201,168,76,.4)">'+avatarInner+'</div>'+
        '<div>'+
          '<div style="font-size:18px;font-weight:900;color:white">'+name+'</div>'+
          (bType?'<div style="font-size:12px;color:rgba(255,255,255,.6)">'+bType+'</div>':'')+
          verifiedBadge+
        '</div>'+
      '</div>'+
      '<div style="margin-top:12px;font-size:13px;color:rgba(255,255,255,.7)">'+
        '🏘️ '+brokerAds.length+' عقار'+(brokerAds.length===1?' معروض':' معروضة')+
      '</div>'+
    '</div>'+
    '<div style="padding:12px">';

  if(!brokerAds.length){
    html += '<div style="text-align:center;padding:40px;color:#8a9ab8"><div style="font-size:48px">🏠</div><div style="font-size:14px;font-weight:700;margin-top:12px">لا توجد عقارات معروضة حالياً</div></div>';
  } else {
    html += brokerAds.map(function(a){
      var pl={apt:'شقة / بيت',land:'أرض',shop:'محل'};
      var pe={apt:'🏠',land:'🌍',shop:'🏪'};
      var imgHtml = a.photos&&a.photos.length
        ?'<img src="'+a.photos[0]+'" style="width:60px;height:60px;border-radius:10px;object-fit:cover;flex-shrink:0">'
        :'<div style="width:60px;height:60px;border-radius:10px;background:#e8e2d4;display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0">'+(pe[a.propType]||'🏠')+'</div>';
      var tags2=[];
      if(a.size) tags2.push(a.propType==='apt'?a.size+' غرف':a.size+' م²');
      if(a.floor) tags2.push('دور '+a.floor);
      if(a.nearSea) tags2.push(a.nearSea);
      return '<div style="display:flex;gap:12px;background:white;border-radius:14px;padding:12px;margin-bottom:10px;border:1px solid #e8e2d4;cursor:pointer" onclick="openPropModal(\''+a.id+'\')">' +
        imgHtml+
        '<div style="flex:1;min-width:0">'+
          '<div style="font-size:13px;font-weight:800;color:#0a1628">'+(pl[a.propType]||'عقار')+' في '+a.region+'</div>'+
          '<div style="font-size:16px;font-weight:900;color:#c9a84c;margin:2px 0">'+Number(a.price).toLocaleString('ar-EG')+' ج.م</div>'+
          (tags2.length?'<div style="font-size:11px;color:#8a9ab8">'+tags2.join(' · ')+'</div>':'')+
          (a.dealType==='sale'
            ?'<span style="font-size:10px;font-weight:800;background:#eff6ff;color:#1d4ed8;padding:2px 8px;border-radius:10px">تمليك</span>'
            :'<span style="font-size:10px;font-weight:800;background:#f0fdf4;color:#166534;padding:2px 8px;border-radius:10px">'+(a.rentType||'إيجار')+'</span>')+
        '</div>'+
        '<div style="color:#c9a84c;font-size:20px;align-self:center">‹</div>'+
      '</div>';
    }).join('');
  }

  html += '</div></div>';

  var bc = document.getElementById('broker-ads-content');
  if(bc) bc.innerHTML = html;
  var ov = document.getElementById('broker-ads-overlay');
  if(ov){ ov.style.display='flex'; setTimeout(function(){ ov.classList.add('open'); },10); }
  _lockScroll();
}

function closeBrokerAds(e){
  if(e && e.target !== document.getElementById('broker-ads-overlay')) return;
  var ov = document.getElementById('broker-ads-overlay');
  if(ov){ ov.classList.remove('open'); setTimeout(function(){ ov.style.display='none'; },300); }
  _unlockScroll();
}
function closeBrokerAdsBtn(){
  var ov = document.getElementById('broker-ads-overlay');
  if(ov){ ov.classList.remove('open'); setTimeout(function(){ ov.style.display='none'; },300); }
  _unlockScroll();
}

/* ════════ BOTTOM NAV ════════ */
(function(){
  var navMap=[
    {id:'home',icon:'🏠',label:'الرئيسية'},
    {id:'tourist',icon:'⛱️',label:'مصيف'},
    {id:'resident',icon:'🏡',label:'تمليك'},
    {id:'favs',icon:'❤️',label:'المفضلة'},
    {id:'register',icon:'👤',label:'حسابي'}
  ];
  var bn=document.getElementById('bottom-nav');
  if(!bn) return;
  bn.innerHTML=navMap.map(function(it){
    return '<button class="nav-item" data-screen="'+it.id+'" onclick="go(\''+it.id+'\')">'
      +'<span class="nicon">'+it.icon+'</span>'+it.label+'</button>';
  }).join('');
  function syncActive(){
    var active=document.querySelector('.screen.active');
    var id=active?active.id.replace(/^s-/,''):'home';
    bn.querySelectorAll('.nav-item').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-screen')===id);
    });
  }
  syncActive();
  var _origGo=window.go;
  if(typeof _origGo==='function'){
    window.go=function(id){ var r=_origGo.apply(this,arguments); syncActive(); return r; };
  }
})();
