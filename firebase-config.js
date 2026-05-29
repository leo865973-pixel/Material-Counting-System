// ============================================================================
// Security & Utility Functions
// ============================================================================
window.hashPassword = (password) => {
  return btoa(encodeURIComponent(password)).split('').reverse().join('') + '_sec';
};

// ============================================================================
// Edge TTS (Text-to-Speech) Engine - Natural English
// ============================================================================
window.playEdgeTTS = async (text, voice = 'en-US-AriaNeural') => {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket('wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4');
      let audioChunks = [];

      ws.onopen = () => {
        const configMsg = `X-Timestamp:${new Date().toISOString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":false,"wordBoundaryEnabled":false},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;
        ws.send(configMsg);

        const requestId = Math.random().toString(36).substring(2, 15);
        const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'><prosody pitch='+0Hz' rate='0%' volume='+0%'>${text}</prosody></voice></speak>`;
        const ssmlMsg = `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${new Date().toISOString()}\r\nPath:ssml\r\n\r\n${ssml}`;
        ws.send(ssmlMsg);
      };

      ws.onmessage = async (e) => {
        if (e.data instanceof Blob) {
          const arrayBuffer = await e.data.arrayBuffer();
          const view = new DataView(arrayBuffer);
          const headerLength = view.getUint16(0);
          audioChunks.push(arrayBuffer.slice(2 + headerLength));
        } else if (typeof e.data === 'string' && e.data.includes('Path:turn.end')) {
          ws.close();
          const blob = new Blob(audioChunks, { type: 'audio/mp3' });
          const audio = new Audio(URL.createObjectURL(blob));
          audio.play().then(() => {
            audio.onended = resolve;
          }).catch(err => {
            console.error("Audio play error:", err);
            resolve();
          });
        }
      };
      
      ws.onerror = (err) => {
        console.error("TTS Error:", err);
        resolve();
      };
    } catch (err) {
      console.error("TTS Exception:", err);
      resolve();
    }
  });
};

// ============================================================================
// Firebase Setup
// ============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyCEQ_UqWbALGnNiwDfWKUBm-nPjIGCSGfc",
  authDomain: "material-counting-system.firebaseapp.com",
  databaseURL: "https://material-counting-system-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "material-counting-system",
  storageBucket: "material-counting-system.firebasestorage.app",
  messagingSenderId: "561524776584",
  appId: "1:561524776584:web:753a9847a5c352e785493d"
};

firebase.initializeApp(firebaseConfig);
window.db = firebase.database();
window.storage = firebase.storage();

// ============================================================================
// Mock Data
// ============================================================================
window.MOCK_USERS = [
  { id: 'u1', name: '王大明', email: 'admin@inv.sys', role: 'admin', avatar: '王', password: window.hashPassword('admin123') },
  { id: 'u2', name: '李經理', email: 'leader@inv.sys', role: 'leader', avatar: '李', password: window.hashPassword('123456') },
  { id: 'u3', name: '陳專員', email: 'op@inv.sys', role: 'operator', avatar: '陳', password: window.hashPassword('654321') }
];

window.MOCK_TAGS = [
  { id: 't1', name: '緊急件', color: 'bg-[#ff3b30]/10 text-[#ff3b30] border-[#ff3b30]/20' },
  { id: 't2', name: '新件', color: 'bg-[#0066cc]/10 text-[#0066cc] border-[#0066cc]/20' },
  { id: 't3', name: '客供件', color: 'bg-[#af52de]/10 text-[#af52de] border-[#af52de]/20' },
  { id: 't4', name: '沿用件', color: 'bg-[#86868b]/10 text-[#86868b] border-[#86868b]/20' }
];

window.MOCK_TASKS = [
  { id: 'tsk-001', title: 'EV馬達A型 試裝物料清點', type: 'trial', description: '新世代電動車馬達試作，確認BOM表物料到貨狀況', status: 'in_progress', due_date: '2024-05-20', created_at: '2024-05-10', progress: 45, owner_id: 'u1', allowed_users: ['u1', 'u2', 'u3'] },
  { id: 'tsk-002', title: '5月第一週 倉庫盤點', type: 'warehouse', description: '針對 A01~A05 架位進行例行性盤點', status: 'pending', due_date: '2024-05-15', created_at: '2024-05-12', progress: 0, owner_id: 'u1', allowed_users: ['u1', 'u2'] },
  { id: 'tsk-003', title: '線邊倉緊急備料確認', type: 'line_side', description: 'B產線臨時換線，確認特殊零組件', status: 'completed', due_date: '2024-05-01', created_at: '2024-05-01', progress: 100, owner_id: 'u1', allowed_users: ['u1', 'u3'] }
];

window.MOCK_MATERIALS = [
  { id: 'mat-001', task_id: 'tsk-001', part_number: 'MOT-A-0012', part_code: 'PT-001', part_name: '定子鐵芯總成', part_name_zh: '定子铁芯总成', unit: 'PCS', usage_per_unit: 1, target_qty: 5, counted_qty: 0, supplier: '供應商A', category: '電機', location: 'A01-01', remark: '', status: 'pending', tags: [window.MOCK_TAGS[0], window.MOCK_TAGS[1]] },
  { id: 'mat-002', task_id: 'tsk-001', part_number: 'BRG-6205-2Z', part_code: 'PT-002', part_name: '深溝玉軸承', part_name_zh: '深沟球轴承', unit: 'PCS', usage_per_unit: 2, target_qty: 10, counted_qty: 10, supplier: '供應商B', category: '機構件', location: 'A01-02', remark: '', status: 'arrived', tags: [window.MOCK_TAGS[3]] },
  { id: 'mat-003', task_id: 'tsk-001', part_number: 'CBL-HV-005', part_code: 'PT-003', part_name: '高壓線束', part_name_zh: '高压线束', unit: 'M', usage_per_unit: 5, target_qty: 25, counted_qty: 12, supplier: '供應商C', category: '線束', location: 'B02-01', remark: '線材長度需特別確認', status: 'partial', tags: [window.MOCK_TAGS[2]] },
  { id: 'mat-004', task_id: 'tsk-002', part_number: 'SCR-M6X20', part_code: 'PT-004', part_name: '六角法蘭螺栓', part_name_zh: '六角法兰螺栓', unit: 'PCS', usage_per_unit: 20, target_qty: 500, counted_qty: 0, supplier: '五金行', category: '緊固件', location: 'C05-03', remark: '', status: 'pending', tags: [] }
];