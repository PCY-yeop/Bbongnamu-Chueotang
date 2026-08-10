import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

// ==========================================
// 사장님 로그인 아이디/비밀번호 설정
// ==========================================
const ADMIN_CREDENTIALS = {
    id: "admin",
    pw: "1234"
};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'bbongnamu-app';
let db, auth, storage, isFirebaseActive = false;

// 클라이언트 상태
window.state = {
    isLoggedIn: false, isEditing: false,
    currentEditingImageId: null, currentDynamicData: null,
    data: {
        staticTexts: {}, staticImages: {},
        subMenus: [
            { id: 'sm_1', badge: "MEAL", name: "제육볶음", price: "13,000원" },
            { id: 'sm_2', badge: "PREMIUM", name: "삼계탕", price: "15,000원" }
        ],
        slides: [
            { id: 'sl_1', img: "https://images.unsplash.com/photo-1595295333158-4742f28fbd85?auto=format&fit=crop&w=800&q=80", badge1: "SIGNATURE", badge2: "KITCHEN", title: "매콤 낙지볶음", desc: "불맛 가득한 매콤달콤 양념" },
            { id: 'sl_2', img: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=800&q=80", badge1: "BEST", badge2: "TRADITIONAL", title: "뽕나무 추어탕", desc: "깊고 구수한 맛" }
        ],
        hours: [
            { dayIdx: 0, dayName: '일', isOpen: false, text: '정기 휴무' },
            { dayIdx: 1, dayName: '월', isOpen: true, time: '11:20 - 20:00', break: 'Break 15-17시' },
            { dayIdx: 2, dayName: '화', isOpen: true, time: '11:20 - 20:00', break: 'Break 15-17시' },
            { dayIdx: 3, dayName: '수', isOpen: true, time: '11:20 - 20:00', break: 'Break 15-17시' },
            { dayIdx: 4, dayName: '목', isOpen: true, time: '11:20 - 20:00', break: 'Break 15-17시' },
            { dayIdx: 5, dayName: '금', isOpen: true, time: '11:20 - 20:00', break: 'Break 15-17시' },
            { dayIdx: 6, dayName: '토', isOpen: true, time: '11:20 - 20:00', break: 'Break 15-17시' }
        ],
        tempHolidayNotice: "" 
    }
};

// Firebase 초기화 로직
async function initFirebase() {
    try {
        const config = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
        if (!config) throw new Error("No config");
        
        const app = initializeApp(config);
        db = getFirestore(app);
        auth = getAuth(app);
        storage = getStorage(app);
        isFirebaseActive = true;

        const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
        if (token) await signInWithCustomToken(auth, token);
        else await signInAnonymously(auth);

        // 실시간 데이터 동기화
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'homepage', 'content');
        onSnapshot(docRef, (snapshot) => {
            if (snapshot.exists()) {
                window.state.data = snapshot.data();
                renderAll();
            } else {
                packStaticToData(); 
                setDoc(docRef, window.state.data);
            }
        }, (error) => console.error("Firebase Snapshot Error:", error));
        
    } catch(e) {
        console.warn("로컬 모드 실행 중 (클라우드 미연결)", e);
        renderAll();
    }
}

// 알림 메시지 (Toast)
window.showToast = function(msg) {
    const toast = document.getElementById('toastMsg');
    document.getElementById('toastText').innerText = msg;
    toast.classList.remove('opacity-0', '-translate-y-4', 'pointer-events-none');
    toast.classList.add('opacity-100', 'translate-y-0');
    setTimeout(() => {
        toast.classList.add('opacity-0', '-translate-y-4', 'pointer-events-none');
        toast.classList.remove('opacity-100', 'translate-y-0');
    }, 3000);
}

// 페이지 라우팅
window.showPage = function(pageId) {
    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 인증 로직
window.processLogin = function() {
    const id = document.getElementById('idInput').value;
    const pw = document.getElementById('pwInput').value;
    if(id === ADMIN_CREDENTIALS.id && pw === ADMIN_CREDENTIALS.pw) {
        window.state.isLoggedIn = true;
        sessionStorage.setItem('isAdmin', 'true');
        document.getElementById('loginModal').classList.add('hidden');
        updateAuthUI();
        window.showToast('관리자 모드로 접속되었습니다.');
    } else {
        window.showToast('아이디 또는 비밀번호가 틀렸습니다.');
    }
}
window.logout = function() {
    window.state.isLoggedIn = false;
    sessionStorage.removeItem('isAdmin');
    if(window.state.isEditing) window.toggleEditMode();
    updateAuthUI();
    window.showToast('안전하게 로그아웃 되었습니다.');
}
function updateAuthUI() {
    document.getElementById('loginBtn').classList.toggle('hidden', window.state.isLoggedIn);
    document.getElementById('logoutBtn').classList.toggle('hidden', !window.state.isLoggedIn);
    document.getElementById('adminPanel').classList.toggle('hidden', !window.state.isLoggedIn);
}

function renderAll() {
    if (window.state.data.staticTexts) {
        for (const [id, value] of Object.entries(window.state.data.staticTexts)) {
            const el = document.getElementById(id);
            if (el) el.innerText = value;
        }
    }
    if (window.state.data.staticImages) {
        for (const [id, value] of Object.entries(window.state.data.staticImages)) {
            const el = document.getElementById(id);
            if (el) {
                if(el.dataset.editType === 'bg-image') el.style.backgroundImage = `url('${value}')`;
                else el.src = value;
            }
        }
    }
    
    renderSubMenus();
    renderSlides();
    renderHours();
}

window.renderSubMenus = function() {
    const container = document.getElementById('subMenuContainer');
    if (!container) return;
    let html = '';
    window.state.data.subMenus.forEach(menu => {
        html += `
        <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col justify-center relative transition-all">
            ${window.state.isEditing ? `<button onclick="window.removeMenu(event, '${menu.id}')" class="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white w-6 h-6 rounded-full text-xs flex items-center justify-center z-50 shadow"><i class="fa-solid fa-xmark"></i></button>` : ''}
            <span class="${window.state.isEditing ? 'edit-mode-active' : ''} text-gray-400 text-[10px] font-bold tracking-widest mb-1 w-fit" data-dynamic="true" data-type="subMenus" data-id="${menu.id}" data-field="badge">${menu.badge}</span>
            <div class="flex justify-between items-end gap-2 mt-1">
                <h4 class="${window.state.isEditing ? 'edit-mode-active' : ''} text-lg font-bold text-gray-900 w-full" data-dynamic="true" data-type="subMenus" data-id="${menu.id}" data-field="name">${menu.name}</h4>
                <span class="${window.state.isEditing ? 'edit-mode-active' : ''} text-orange-700 font-bold whitespace-nowrap" data-dynamic="true" data-type="subMenus" data-id="${menu.id}" data-field="price">${menu.price}</span>
            </div>
        </div>`;
    });
    if (window.state.isEditing) html += `<div onclick="window.addMenu()" class="bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-200"><i class="fa-solid fa-plus text-gray-400"></i></div>`;
    container.innerHTML = html;
    attachDynamicListeners(container);
}

let currentSlideIndex = 0;
let slideInterval = null;
window.renderSlides = function() {
    const cont = document.getElementById('slideContainer');
    const thumb = document.getElementById('thumbnail-container');
    if(!cont || !thumb) return;
    if(currentSlideIndex >= window.state.data.slides.length) currentSlideIndex = 0;
    
    let sHtml = '', tHtml = '';
    window.state.data.slides.forEach((sl, idx) => {
        const isActive = idx === currentSlideIndex ? 'active' : '';
        tHtml += `<div class="relative shrink-0"><img onclick="window.goToSlide(${idx})" class="thumb-item ${isActive} w-20 h-14 md:w-28 md:h-20 rounded-xl object-cover cursor-pointer" src="${sl.img}"><button onclick="window.removeSlide(event, '${sl.id}')" class="${window.state.isEditing ? 'flex' : 'hidden'} absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white w-5 h-5 rounded-full text-[10px] items-center justify-center z-50"><i class="fa-solid fa-xmark"></i></button></div>`;
        sHtml += `
        <div class="slide-item ${isActive} flex flex-col md:flex-row bg-white w-full h-full">
            <div class="w-full md:w-1/2 h-full relative overflow-hidden group ${window.state.isEditing ? 'edit-mode-active' : ''}">
                <img data-dynamic-image="true" data-type="slides" data-id="${sl.id}" data-field="img" src="${sl.img}" class="w-full h-full object-cover">
                ${window.state.isEditing ? `<div class="image-edit-overlay opacity-0 group-hover:opacity-100 transition" style="pointer-events: none;">사진 교체 (클릭)</div>` : ''}
            </div>
            <div class="w-full md:w-1/2 h-full bg-white p-8 md:p-14 flex flex-col justify-center">
                <div class="flex gap-2 mb-4">
                    <span class="${window.state.isEditing ? 'edit-mode-active' : ''} bg-orange-700 text-white text-[10px] font-bold px-3 py-1 rounded-full" data-dynamic="true" data-type="slides" data-id="${sl.id}" data-field="badge1">${sl.badge1}</span>
                </div>
                <h3 class="${window.state.isEditing ? 'edit-mode-active' : ''} text-3xl md:text-5xl font-black mb-4 w-fit" data-dynamic="true" data-type="slides" data-id="${sl.id}" data-field="title">${sl.title}</h3>
                <p class="${window.state.isEditing ? 'edit-mode-active' : ''} text-gray-500" data-dynamic="true" data-type="slides" data-id="${sl.id}" data-field="desc">${sl.desc}</p>
            </div>
        </div>`;
    });
    if(window.state.isEditing) tHtml += `<div onclick="window.addSlide()" class="shrink-0 w-20 h-14 md:w-28 md:h-20 bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center cursor-pointer"><i class="fa-solid fa-plus text-gray-400"></i></div>`;
    cont.innerHTML = sHtml; thumb.innerHTML = tHtml;
    attachDynamicListeners(cont); attachDynamicListeners(thumb);
    if(!window.state.isEditing) startSlideShow();
}

window.renderHours = function() {
    const container = document.getElementById('hoursContainer');
    if(!container) return;
    const todayIdx = new Date().getDay();
    let html = `<div class="mb-4 pb-4 border-b border-gray-100"><p class="text-sm font-bold text-gray-500 mb-1">공지사항 (휴무 등)</p><div class="${window.state.isEditing ? 'edit-mode-active' : ''} text-red-500 font-bold w-full min-h-[24px]" data-dynamic="true" data-type="temp" data-id="tempHolidayNotice" data-field="text">${window.state.data.tempHolidayNotice || (window.state.isEditing ? '입력하세요...' : '')}</div></div>`;

    for (let i = 0; i < 7; i++) {
        const targetIdx = (todayIdx + i) % 7;
        const h = window.state.data.hours.find(x => x.dayIdx === targetIdx);
        const isToday = i === 0;
        
        html += `<div class="flex justify-between items-center py-4 border-b border-gray-50 last:border-0 ${isToday ? 'bg-[#fff5f2]' : ''} rounded-xl px-4 -mx-4">
            <div class="font-bold ${isToday ? 'text-[#c04b20]' : 'text-gray-700'}">${isToday ? `오늘(${h.dayName})` : `${h.dayName}요일`}</div>
            <div class="text-right">
                ${h.isOpen ? `
                    <div class="${window.state.isEditing ? 'edit-mode-active' : ''} font-bold text-gray-800" data-dynamic="true" data-type="hours" data-id="${targetIdx}" data-field="time">${h.time}</div>
                    <div class="${window.state.isEditing ? 'edit-mode-active' : ''} text-sm text-gray-400" data-dynamic="true" data-type="hours" data-id="${targetIdx}" data-field="break">${h.break}</div>
                ` : `<div class="${window.state.isEditing ? 'edit-mode-active' : ''} font-bold text-red-500 bg-white border border-red-100 px-3 py-1 rounded-lg text-sm" data-dynamic="true" data-type="hours" data-id="${targetIdx}" data-field="text">${h.text}</div>`}
            </div>
        </div>`;
    }
    container.innerHTML = html;
    attachDynamicListeners(container);
}

function attachDynamicListeners(c) {
    if(!window.state.isEditing) return;
    c.querySelectorAll('[data-dynamic="true"]').forEach(el => {
        el.contentEditable = "true";
        el.oninput = (e) => {
            const {type, id, field} = el.dataset;
            if(type === 'temp') window.state.data.tempHolidayNotice = el.innerText;
            else if (type === 'hours') window.state.data.hours.find(i => i.dayIdx == id)[field] = el.innerText;
            else window.state.data[type].find(i => i.id == id)[field] = el.innerText;
        };
    });
    c.querySelectorAll('[data-dynamic-image="true"]').forEach(el => {
        el.onclick = (e) => {
            e.preventDefault();
            window.state.currentDynamicData = { type: el.dataset.type, id: el.dataset.id, field: el.dataset.field };
            window.state.currentEditingImageId = null;
            document.getElementById('imageUploader').click();
        };
    });
}

function packStaticToData() {
    window.state.data.staticTexts = {};
    document.querySelectorAll('[data-edit-type="text"]').forEach(el => {
        window.state.data.staticTexts[el.id] = el.innerText;
    });
    window.state.data.staticImages = {};
    document.querySelectorAll('[data-edit-type="image"], [data-edit-type="bg-image"]').forEach(el => {
        if(!el.dataset.dynamicImage) {
            window.state.data.staticImages[el.id] = el.dataset.editType === 'bg-image' ? el.style.backgroundImage.replace(/^url\(["']?/, '').replace(/["']?\)$/, '') : el.src;
        }
    });
}

window.toggleEditMode = function() {
    window.state.isEditing = !window.state.isEditing;
    const btn = document.getElementById('editToggleBtn');
    const sBtn = document.getElementById('saveChangesBtn');
    
    if(window.state.isEditing) {
        btn.innerHTML = '<i class="fa-solid fa-xmark"></i> <span>수정 취소하기</span>';
        sBtn.classList.remove('hidden');
        stopSlideShow();
        document.querySelectorAll('[data-edit-type="text"]').forEach(el => el.contentEditable = "true");
        document.querySelectorAll('[data-edit-type="image"], [data-edit-type="bg-image"]').forEach(el => {
            if(el.dataset.dynamicImage) return;
            el.onclick = (e) => { e.preventDefault(); window.state.currentEditingImageId = el.id; window.state.currentDynamicData = null; document.getElementById('imageUploader').click(); };
        });
    } else {
        btn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> <span>내용/사진 수정하기</span>';
        sBtn.classList.add('hidden');
        document.querySelectorAll('[data-edit-type="text"]').forEach(el => el.contentEditable = "false");
        document.querySelectorAll('[data-edit-type="image"], [data-edit-type="bg-image"]').forEach(el => el.onclick = null);
    }
    renderAll();
}

window.handleImageSelected = async function(event) {
    const file = event.target.files[0];
    if(!file) return;
    window.showToast("이미지 업로드 중입니다...");
    
    let imgUrl = "";
    if (isFirebaseActive && storage) {
        try {
            const sRef = ref(storage, `artifacts/${appId}/images/${Date.now()}_${file.name}`);
            await uploadBytes(sRef, file);
            imgUrl = await getDownloadURL(sRef);
        } catch(e) { console.error("Storage upload failed", e); }
    }
    
    if(!imgUrl) {
        imgUrl = await new Promise((res) => {
            const r = new FileReader(); r.onload = (e) => res(e.target.result); r.readAsDataURL(file);
        });
    }

    if(window.state.currentDynamicData) {
        const { type, id, field } = window.state.currentDynamicData;
        window.state.data[type].find(i => i.id === id)[field] = imgUrl;
        renderSlides();
    } else if(window.state.currentEditingImageId) {
        const el = document.getElementById(window.state.currentEditingImageId);
        if(el.dataset.editType === 'bg-image') el.style.backgroundImage = `url('${imgUrl}')`;
        else el.src = imgUrl;
    }
    event.target.value = '';
    window.showToast("이미지가 변경되었습니다. 꼭 '저장'을 눌러주세요.");
}

window.saveContentToCloud = async function() {
    window.showToast("클라우드에 저장하는 중...");
    packStaticToData();
    if(isFirebaseActive && db) {
        try {
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'homepage', 'content'), window.state.data);
            window.showToast("클라우드에 안전하게 저장되었습니다!");
        } catch(e) {
            window.showToast("저장 권한이 없거나 오류가 발생했습니다.");
        }
    } else {
        window.showToast("현재 로컬 모드입니다. 브라우저 메모리에 임시 저장되었습니다.");
    }
    window.toggleEditMode();
}

function startSlideShow() { if(window.state.data.slides.length > 1) slideInterval = setInterval(window.nextSlide, 3000); }
function stopSlideShow() { clearInterval(slideInterval); }
window.nextSlide = () => window.goToSlide((currentSlideIndex + 1) % window.state.data.slides.length);
window.prevSlide = () => window.goToSlide((currentSlideIndex - 1 + window.state.data.slides.length) % window.state.data.slides.length);
window.goToSlide = (idx) => {
    currentSlideIndex = idx;
    document.querySelectorAll('.slide-item').forEach((el, i) => el.classList.toggle('active', i === idx));
    document.querySelectorAll('.thumb-item').forEach((el, i) => el.classList.toggle('active', i === idx));
    if(!window.state.isEditing) { stopSlideShow(); startSlideShow(); }
};
window.addMenu = () => { window.state.data.subMenus.push({ id: 'sm_'+Date.now(), badge: "NEW", name: "새 메뉴", price: "0원" }); renderSubMenus(); };
window.removeMenu = (e, id) => { e.stopPropagation(); window.state.data.subMenus = window.state.data.subMenus.filter(m => m.id !== id); renderSubMenus(); };
window.addSlide = () => { window.state.data.slides.push({ id: 'sl_'+Date.now(), img: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80", badge1: "NEW", badge2: "GALLERY", title: "새 사진", desc: "설명을 입력하세요." }); renderSlides(); };
window.removeSlide = (e, id) => { e.stopPropagation(); window.state.data.slides = window.state.data.slides.filter(s => s.id !== id); renderSlides(); window.goToSlide(0); };

window.addEventListener('DOMContentLoaded', () => {
    if(sessionStorage.getItem('isAdmin') === 'true') {
        window.state.isLoggedIn = true; updateAuthUI();
    }
    initFirebase();
});