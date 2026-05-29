```javascript
const { useState, useMemo, useRef, useEffect } = React;

// ============================================================================
// Cross-Module Copy Modals
// ============================================================================
const CopyToVehicleModal = ({ isOpen, onClose, sourceMaterials, isConnected, currentUser }) => {
  const [vehicles, setVehicles] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedV, setSelectedV] = useState('');
  const [selectedS, setSelectedS] = useState('');

  useEffect(() => {
    if (isOpen) {
      db.ref('vehicles').once('value', snap => {
        const d = snap.val();
        setVehicles(d ? Object.keys(d).map(k => ({...d[k], id: k})) : []);
      });
      db.ref('vehicle_sections').once('value', snap => {
        const d = snap.val();
        setSections(d ? Object.keys(d).map(k => ({...d[k], id: k})) : []);
      });
    }
  }, [isOpen]);

  const handleCopy = () => {
    if (!isConnected) return showToast('系統未連線，無法複製', 'error');
    if (!selectedS) return showToast('請選擇目標部位', 'error');
    
    const updates = {};
    sourceMaterials.forEach(m => {
      const newRef = db.ref('vehicle_materials').push();
      updates[`vehicle_materials/${newRef.key}`] = {
        ...m, id: newRef.key, section_id: selectedS, task_id: null,
        spec_params: m.spec_params || '', assembly_group: m.assembly_group || '', image_url: m.image_url || ''
      };
    });
    
    db.ref().update(updates).then(() => {
      db.ref('vehicle_audit_logs').push({
        section_id: selectedS, action: 'CREATE', action_label: '批次複製', entity_name: `自其他模組複製 ${sourceMaterials.length} 筆`, changes: [], user_name: currentUser.name, timestamp: new Date().toISOString()
      });
      showToast(`成功複製 ${sourceMaterials.length} 筆物料至車型部位`, 'success');
      onClose();
    });
  };

  const filteredSections = sections.filter(s => s.vehicle_id === selectedV);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="複製到車型管理">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-2">選擇目標車型</label>
          <select className="flex h-11 w-full rounded-xl border border-[#d2d2d7] bg-white/50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#0066cc]/50" value={selectedV} onChange={e => {setSelectedV(e.target.value); setSelectedS('');}}>
            <option value="">請選擇車型...</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2">選擇目標部位</label>
          <select className="flex h-11 w-full rounded-xl border border-[#d2d2d7] bg-white/50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#0066cc]/50" value={selectedS} onChange={e => setSelectedS(e.target.value)} disabled={!selectedV}>
            <option value="">請選擇部位...</option>
            {filteredSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex justify-end space-x-3 pt-4">
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={handleCopy} disabled={!selectedS}>確認複製</Button>
        </div>
      </div>
    </Modal>
  );
};

const CopyToTaskModal = ({ isOpen, onClose, sourceMaterials, isConnected, currentUser }) => {
  const [tasks, setTasks] = useState([]);
  const [selectedT, setSelectedT] = useState('');

  useEffect(() => {
    if (isOpen) {
      db.ref('tasks').once('value', snap => {
        const d = snap.val();
        setTasks(d ? Object.keys(d).map(k => ({...d[k], id: k})) : []);
      });
    }
  }, [isOpen]);

  const handleCopy = () => {
    if (!isConnected) return showToast('系統未連線，無法複製', 'error');
    if (!selectedT) return showToast('請選擇目標任務', 'error');
    
    const updates = {};
    sourceMaterials.forEach(m => {
      const newRef = db.ref('materials').push();
      updates[`materials/${newRef.key}`] = {
        ...m, id: newRef.key, task_id: selectedT, section_id: null
      };
    });
    
    db.ref().update(updates).then(() => {
      db.ref('audit_logs').push({
        task_id: selectedT, action: 'CREATE', action_label: '批次複製', entity_name: `自車型模組複製 ${sourceMaterials.length} 筆`, changes: [], user_name: currentUser.name, timestamp: new Date().toISOString()
      });
      showToast(`成功複製 ${sourceMaterials.length} 筆物料至任務`, 'success');
      onClose();
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="複製到任務管理">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-2">選擇目標任務</label>
          <select className="flex h-11 w-full rounded-xl border border-[#d2d2d7] bg-white/50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#0066cc]/50" value={selectedT} onChange={e => setSelectedT(e.target.value)}>
            <option value="">請選擇任務...</option>
            {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </div>
        <div className="flex justify-end space-x-3 pt-4">
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={handleCopy} disabled={!selectedT}>確認複製</Button>
        </div>
      </div>
    </Modal>
  );
};

// ============================================================================
// Dynamic Batch Edit Modal
// ============================================================================
const BatchEditModal = ({ isOpen, onClose, selectedIds, onApply, isVehicleMode }) => {
  const [field, setField] = useState('category');
  const [value, setValue] = useState('');

  if (!isOpen) return null;

  const fields = [
    { key: 'category', label: '零件分類' },
    { key: 'supplier', label: '廠商' },
    { key: 'location', label: '儲位' },
    { key: 'remark', label: '備註' },
    { key: 'tags', label: '標籤 (逗號分隔)' },
    { key: 'usage_per_unit', label: '單台用量', type: 'number' },
    { key: 'target_qty', label: '目標數量', type: 'number' },
    { key: 'part_code', label: '件號' },
    { key: 'part_name', label: '件名' },
    { key: 'part_name_zh', label: '中文件名' },
    { key: 'unit', label: '單位' }
  ];

  if (isVehicleMode) {
    fields.push({ key: 'spec_params', label: '規格參數' });
    fields.push({ key: 'assembly_group', label: '組裝作業' });
    fields.push({ key: 'image_url', label: '圖片網址' });
  }

  const handleApply = () => {
    onApply(field, value);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`批次編輯 (${selectedIds.length} 筆)`}>
      <div className="space-y-4">
        <div className="p-3 bg-[#0066cc]/10 text-[#0066cc] rounded-xl text-xs font-medium">
          提示：若要「批次移除」某個欄位的值，請選擇該欄位並將內容「留空」後儲存即可。
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2">選擇要修改的欄位</label>
          <select className="flex h-11 w-full rounded-xl border border-[#d2d2d7] bg-white/50 px-4 text-sm outline-none focus:ring-2 focus:ring-[#0066cc]/50" value={field} onChange={e => {setField(e.target.value); setValue('');}}>
            {fields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2">輸入新內容</label>
          <Input type={fields.find(f => f.key === field)?.type || 'text'} value={value} onChange={e => setValue(e.target.value)} placeholder="輸入新內容 (留空表示清除)..." />
        </div>
        <div className="flex justify-end space-x-3 pt-4">
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={handleApply}>套用變更</Button>
        </div>
      </div>
    </Modal>
  );
};

// ============================================================================
// Login Screen
// ============================================================================
const LoginScreen = ({ onLogin, adminPassword, users }) => {
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('normal');

  const handleLogin = (e) => {
    e.preventDefault();
    if (mode === 'normal') {
      const hashedInput = hashPassword(password);
      const matchedUser = users.find(u => u.password === hashedInput);
      if (matchedUser) {
        onLogin('normal', matchedUser);
        showToast(`歡迎回來，${matchedUser.name}`, 'success');
      } else {
        showToast('密碼錯誤，請重新輸入', 'error');
      }
    } else {
      if (password === adminPassword) {
        onLogin('admin');
        showToast('已進入後台管理', 'success');
      } else {
        showToast('管理員密碼錯誤', 'error');
      }
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-[#f5f5f7] relative overflow-hidden px-4">
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-400/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-400/10 rounded-full blur-[120px] pointer-events-none"></div>
      
      <div className="w-full max-w-[420px] p-8 sm:p-10 bg-white/60 backdrop-blur-3xl border border-white/40 rounded-[2.5rem] shadow-[0_8px_40px_rgb(0,0,0,0.04)] relative z-10">
        <div className="flex flex-col items-center mb-8 sm:mb-10">
          <img src="./logo.png" onError={(e) => { e.target.onerror = null; e.target.src = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/CMC_logo.svg/320px-CMC_logo.svg.png'; }} alt="CMC Logo" className="h-16 sm:h-20 mb-5 sm:mb-6 object-contain drop-shadow-sm" />
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1d1d1f]">物料盤點系統</h1>
          <p className="text-[#86868b] mt-2 text-xs sm:text-sm font-medium tracking-wide">{mode === 'admin' ? '後台管理登入' : '智慧物料清點平台'}</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-5 sm:space-y-6">
          <div><Input type="password" placeholder={mode === 'admin' ? "請輸入管理者密碼" : "請輸入個人登入密碼"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 sm:h-14 text-center tracking-[0.2em] text-base sm:text-lg rounded-2xl bg-white/80" autoFocus /></div>
          <Button type="submit" size="lg" className={`w-full h-12 sm:h-14 text-sm sm:text-base rounded-2xl ${mode === 'admin' ? 'bg-[#1d1d1f] hover:bg-[#424245]' : 'bg-[#0066cc] hover:bg-[#005bb5]'}`}>{mode === 'admin' ? '進入後台' : '登入系統'}</Button>
        </form>
        <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-[#d2d2d7]/30 text-center">
          <button type="button" onClick={() => { setMode(mode === 'normal' ? 'admin' : 'normal'); setPassword(''); }} className="text-[#86868b] hover:text-[#1d1d1f] text-xs sm:text-sm font-medium transition-colors flex items-center justify-center w-full">
            {mode === 'normal' ? <><Icon name="Shield" className="w-4 h-4 mr-1.5"/> 進入後台管理系統</> : <><Icon name="ArrowLeft" className="w-4 h-4 mr-1.5"/> 返回一般登入</>}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Audit Log Modal Component
// ============================================================================
const AuditLogModal = ({ isOpen, onClose, logs }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');

  if (!isOpen) return null;

  const filteredLogs = logs.filter(log => {
     const matchAction = filterAction === 'ALL' || log.action === filterAction;
     const searchLower = searchTerm.toLowerCase();
     const matchSearch = (log.entity_name || '').toLowerCase().includes(searchLower) ||
                         (log.user_name || '').toLowerCase().includes(searchLower) ||
                         (log.changes || []).some(c => c.field.toLowerCase().includes(searchLower) || String(c.old).toLowerCase().includes(searchLower) || String(c.new).toLowerCase().includes(searchLower));
     return matchAction && matchSearch;
  });

  const formatDateTime = (isoString) => {
      if(!isoString) return '';
      const d = new Date(isoString);
      return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const getActionColor = (action) => {
      if(action === 'CREATE') return 'bg-[#34c759]';
      if(action === 'UPDATE') return 'bg-[#0066cc]';
      if(action === 'DELETE') return 'bg-[#ff3b30]';
      return 'bg-[#86868b]';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="操作紀錄" maxWidth="max-w-2xl">
      <div className="p-4 sm:p-6 border-b border-[#d2d2d7]/30 bg-[#f5f5f7]/50 flex flex-col sm:flex-row gap-3 shrink-0 -mx-5 sm:-mx-6 -mt-5 sm:-mt-6 mb-4">
         <div className="relative flex-1">
            <Icon name="Search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
            <Input placeholder="搜尋人員、物料、修改內容..." className="pl-9 bg-white h-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
         </div>
         <select className="h-10 rounded-xl border border-[#d2d2d7] bg-white px-3 text-sm text-[#1d1d1f] shadow-sm outline-none focus:ring-2 focus:ring-[#0066cc]/50" value={filterAction} onChange={e => setFilterAction(e.target.value)}>
            <option value="ALL">所有操作</option>
            <option value="CREATE">新增</option>
            <option value="UPDATE">編輯</option>
            <option value="DELETE">刪除</option>
         </select>
      </div>
      <div className="overflow-y-auto flex-1">
         {filteredLogs.length > 0 ? (
            <div className="relative pl-6 border-l-2 border-[#d2d2d7]/40 space-y-8 py-2">
               {filteredLogs.map((log, idx) => (
                  <div key={log.id || idx} className="relative">
                     <div className={`absolute -left-[29px] top-1 w-3.5 h-3.5 rounded-full ${getActionColor(log.action)} ring-4 ring-white shadow-sm`}></div>
                     <div className="flex flex-wrap items-center gap-2 text-xs text-[#86868b] mb-1.5 font-medium">
                        <span className="text-[#1d1d1f] font-bold bg-[#f5f5f7] px-2 py-0.5 rounded-md border border-[#d2d2d7]/50">{log.user_name}</span>
                        <span>{formatDateTime(log.timestamp)}</span>
                     </div>
                     <div className="bg-white p-4 rounded-2xl border border-[#d2d2d7]/50 shadow-sm hover:shadow-md transition-shadow">
                        <div className="font-semibold text-sm text-[#1d1d1f] mb-3 flex items-center">
                           <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wider font-bold mr-2 text-white ${getActionColor(log.action)}`}>{log.action_label}</span>
                           {log.entity_name}
                        </div>
                        {log.changes && log.changes.length > 0 && (
                           <div className="space-y-2 bg-[#f5f5f7]/50 p-3 rounded-xl border border-[#d2d2d7]/30">
                              {log.changes.map((c, i) => (
                                 <div key={i} className="text-xs flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                    <span className="font-bold text-[#86868b] w-20 shrink-0">{c.field}</span>
                                    <div className="flex items-center flex-1 flex-wrap gap-1.5">
                                       {log.action !== 'CREATE' && <span className="bg-[#ff3b30]/10 text-[#ff3b30] px-1.5 py-0.5 rounded line-through max-w-[150px] truncate" title={c.old}>{c.old || '(空)'}</span>}
                                       {log.action === 'UPDATE' && <Icon name="ArrowRight" className="w-3 h-3 text-[#86868b] shrink-0"/>}
                                       {log.action !== 'DELETE' && <span className="bg-[#34c759]/10 text-[#34c759] px-1.5 py-0.5 rounded font-medium max-w-[150px] truncate" title={c.new}>{c.new || '(空)'}</span>}
                                    </div>
                                 </div>
                              ))}
                           </div>
                        )}
                     </div>
                  </div>
               ))}
            </div>
         ) : (
            <div className="flex flex-col items-center justify-center h-40 text-[#86868b]">
               <Icon name="Inbox" className="w-10 h-10 mb-2 opacity-50" />
               <p className="text-sm font-medium">沒有符合的操作紀錄</p>
            </div>
         )}
      </div>
    </Modal>
  );
};

// ============================================================================
// Task Access Management Modal
// ============================================================================
const TaskAccessModal = ({ isOpen, onClose, task, users, currentUser, isConnected }) => {
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (task) setSelectedUsers(task.allowed_users || []);
  }, [task]);

  if (!isOpen || !task) return null;

  const handleToggleUser = (userId) => {
    if (selectedUsers.includes(userId)) setSelectedUsers(selectedUsers.filter(id => id !== userId));
    else setSelectedUsers([...selectedUsers, userId]);
  };

  const handleSave = () => {
    if (!isConnected) return showToast('系統未連線，無法儲存', 'error');
    db.ref(`tasks/${task.id}`).update({ allowed_users: selectedUsers }).then(() => {
      showToast('權限更新成功', 'success');
      onClose();
    });
  };

  const filteredUsers = users.filter(u => u.name.includes(searchTerm) || u.email.includes(searchTerm));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="專案權限管理">
      <div className="space-y-4 sm:space-y-5">
        <Input placeholder="搜尋使用者..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
          {filteredUsers.map(u => {
            const isOwner = u.id === task.owner_id;
            const isForced = isOwner;
            const isChecked = isForced || selectedUsers.includes(u.id);

            return (
              <label key={u.id} className={`flex items-center p-3 rounded-xl border ${isChecked ? 'border-[#0066cc] bg-[#0066cc]/5' : 'border-[#d2d2d7]/50 bg-white'} cursor-pointer transition-colors`}>
                <input type="checkbox" className="hidden" checked={isChecked} disabled={isForced} onChange={() => handleToggleUser(u.id)} />
                <div className={`w-5 h-5 rounded flex items-center justify-center mr-3 shrink-0 ${isChecked ? 'bg-[#0066cc] border-none' : 'border border-[#d2d2d7]'}`}>
                  {isChecked && <Icon name="Check" className="w-3 h-3 text-white" />}
                </div>
                <div className="flex-1 truncate pr-2">
                  <div className="font-semibold text-sm text-[#1d1d1f] truncate">{u.name}</div>
                  <div className="text-xs text-[#86868b] truncate">{u.email}</div>
                </div>
                <div className="shrink-0">
                  {isOwner ? <Badge className="bg-[#0066cc]/10 text-[#0066cc] border-none">OWNER</Badge> :
                   isChecked ? <Badge className="bg-[#34c759]/10 text-[#34c759] border-none">{u.role === 'admin' ? 'ADMIN' : 'MEMBER'}</Badge> : null}
                </div>
              </label>
            );
          })}
        </div>
        <div className="pt-4 sm:pt-6 flex justify-end space-x-3">
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={handleSave}>儲存設定</Button>
        </div>
      </div>
    </Modal>
  );
};

// ============================================================================
// Excel Manager Modal
// ============================================================================
const ExcelManagerModal = ({ isOpen, onClose, task, materials, onImportSuccess, isVehicleMode = false }) => {
  const [activeTab, setActiveTab] = useState('import');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importPreview, setImportPreview] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const loadXLSX = () => {
    if (window.XLSX) return window.XLSX;
    showToast("Excel 模組尚未載入完成", "error");
    return null;
  };

  const handleDownloadTemplate = () => {
    const XLSX = loadXLSX();
    if (!XLSX) return;
    
    let templateData;
    if (isVehicleMode) {
      templateData = [{ "UPG": "MOT-A-0012", "件號": "PT-001", "件名": "定子鐵芯總成", "中文件名": "定子铁芯总成", "單位": "PCS", "單台用量": 1, "目標數量": 100, "廠商": "供應商A", "零件分類": "電機", "儲位": "A01-01", "標籤": "緊急件,新件", "備註": "", "規格參數": "扭力 5Nm", "組裝作業": "馬達外殼組裝" }];
    } else {
      templateData = [{ "UPG": "MOT-A-0012", "件號": "PT-001", "件名": "定子鐵芯總成", "中文件名": "定子铁芯总成", "單位": "PCS", "單台用量": 1, "目標數量": 100, "廠商": "供應商A", "零件分類": "電機", "儲位": "A01-01", "標籤": "緊急件,新件", "備註": "" }];
    }

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "匯入範本");
    XLSX.writeFile(wb, "匯入範本.xlsx");
  };

  const handleExport = () => {
    const XLSX = loadXLSX();
    if (!XLSX) return;
    
    const exportData = materials.map(m => {
      const base = {
        "UPG": m.part_number, "件號": m.part_code || '', "件名": m.part_name, "中文件名": m.part_name_zh || '', "單位": m.unit, "單台用量": m.usage_per_unit || 1, "目標數量": m.target_qty, "已清點數量": m.counted_qty, "差異數量": m.counted_qty - m.target_qty, "狀態": m.counted_qty >= m.target_qty ? '已完成' : (m.counted_qty > 0 ? '清點中' : '未清點'), "廠商": m.supplier || '', "零件分類": m.category || '', "儲位": m.location || '', "標籤": (m.tags || []).map(t => t.name).join(','), "備註": m.remark || ''
      };
      if (isVehicleMode) {
        base["規格參數"] = m.spec_params || ''; base["組裝作業"] = m.assembly_group || '';
      }
      return base;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "清點結果");
    XLSX.writeFile(wb, `[${task.title || task.name}]_結果.xlsx`);
    showToast("匯出成功", "success");
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessing(true);
    const XLSX = loadXLSX();
    if (!XLSX) return setIsProcessing(false);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        const errors = [];
        const previewData = [];
        const seen = new Set();

        data.forEach((row, i) => {
          const rowNum = i + 2;
          const rowErrs = [];
          const partNo = String(row['UPG'] || '').trim();
          const targetQty = Number(row['目標數量']);

          if (!partNo) rowErrs.push("缺UPG");
          if (isNaN(targetQty) || targetQty < 0) rowErrs.push("目標數量錯誤");
          if (partNo && seen.has(partNo)) rowErrs.push("檔案內UPG 重複");
          if (partNo && materials.some(m => m.part_number === partNo)) rowErrs.push("系統已存在");
          seen.add(partNo);

          if (rowErrs.length > 0) errors.push({ row: rowNum, errors: rowErrs });
          previewData.push({ ...row, _rowNum: rowNum, _errors: rowErrs });
        });

        setImportErrors(errors);
        setImportPreview(previewData);
      } catch (error) {
        showToast("解析失敗", "error");
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const confirmImport = () => {
    const newMaterials = importPreview.filter(row => row._errors.length === 0).map(row => {
      const tagsStr = String(row['標籤'] || '');
      const parsedTags = tagsStr.split(',').map(t => t.trim()).filter(t => t).map(tagName => {
          const existing = MOCK_TAGS.find(mt => mt.name === tagName);
          return existing || { id: 'tag-'+Math.random().toString(36).substr(2,5), name: tagName, color: 'bg-[#f5f5f7] text-[#1d1d1f] border-[#d2d2d7]' };
      });

      const baseMat = {
        part_number: String(row['UPG']).trim(), part_code: String(row['件號'] || '').trim(), part_name: String(row['件名'] || ''), part_name_zh: String(row['中文件名'] || ''), unit: String(row['單位'] || 'PCS'), usage_per_unit: Number(row['單台用量']) || 1, target_qty: Number(row['目標數量']), counted_qty: 0, supplier: String(row['廠商'] || row['供應商'] || ''), category: String(row['零件分類'] || ''), location: String(row['儲位'] || ''), remark: String(row['備註'] || ''), status: 'pending', tags: parsedTags
      };

      if (isVehicleMode) {
        baseMat.spec_params = String(row['規格參數'] || ''); baseMat.assembly_group = String(row['組裝作業'] || ''); baseMat.image_url = '';
      }
      return baseMat;
    });
    if (newMaterials.length > 0) {
      onImportSuccess(newMaterials);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="批次作業" maxWidth="max-w-2xl">
      <div className="flex p-2 bg-[#f5f5f7] -mx-2 sm:-mx-4 -mt-2 sm:-mt-4 mb-4 rounded-xl shrink-0">
        <button className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'import' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#86868b] hover:text-[#1d1d1f]'}`} onClick={() => setActiveTab('import')}>匯入資料</button>
        <button className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'export' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#86868b] hover:text-[#1d1d1f]'}`} onClick={() => setActiveTab('export')}>匯出報表</button>
      </div>
      <div className="overflow-auto flex-1">
        {activeTab === 'import' ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between bg-[#f5f5f7]/50 p-4 rounded-2xl border border-[#d2d2d7]/50 items-start sm:items-center shadow-sm gap-3 sm:gap-0">
              <span className="text-sm text-[#1d1d1f] font-medium">1. 下載標準格式範本</span>
              <Button variant="secondary" size="sm" onClick={handleDownloadTemplate} className="w-full sm:w-auto">下載範本</Button>
            </div>
            <div className="flex flex-col sm:flex-row justify-between bg-[#f5f5f7]/50 p-4 rounded-2xl border border-[#d2d2d7]/50 items-start sm:items-center shadow-sm gap-3 sm:gap-0">
              <span className="text-sm text-[#1d1d1f] font-medium">2. 上傳填寫好的資料</span>
              <input type="file" accept=".xlsx" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
              <Button onClick={() => fileInputRef.current?.click()} isLoading={isProcessing} className="w-full sm:w-auto"><Icon name="Upload" className="w-4 h-4 mr-2"/>上傳檔案</Button>
            </div>
            {importPreview.length > 0 && (
              <div className="mt-6 border border-[#d2d2d7]/50 rounded-2xl overflow-hidden text-sm bg-white shadow-sm">
                 <div className="bg-[#f5f5f7] p-4 flex justify-between font-medium border-b border-[#d2d2d7]/50">
                   <span className="text-[#34c759]">✅ 成功: {importPreview.length - importErrors.length}</span>
                   <span className="text-[#ff3b30]">❌ 失敗: {importErrors.length}</span>
                 </div>
                 <div className="max-h-48 overflow-auto">
                    {importPreview.map((row, i) => (
                      <div key={i} className={`flex p-3 border-b border-[#f5f5f7] ${row._errors.length > 0 ? 'bg-[#ff3b30]/5' : ''}`}>
                        <div className="w-24 sm:w-28 text-[#86868b] font-mono text-xs truncate">{row['UPG']}</div>
                        <div className="flex-1 text-[#1d1d1f] font-medium truncate px-2">{row['件名']}</div>
                        <div className="w-16 sm:w-24 text-right shrink-0">
                           {row._errors.length > 0 ? <span className="text-[#ff3b30] text-xs font-semibold">有錯誤</span> : <span className="text-[#34c759] text-xs font-semibold">通過</span>}
                        </div>
                      </div>
                    ))}
                 </div>
              </div>
            )}
            {importPreview.length > 0 && (
              <div className="pt-4 flex justify-end">
                <Button variant="primary" onClick={confirmImport} disabled={importPreview.length === importErrors.length} className="w-full sm:w-auto">確認匯入資料</Button>
              </div>
            )}
          </div>
        ) : (
           <div className="text-center py-12 space-y-6">
              <div className="w-16 h-16 bg-[#0066cc]/10 rounded-full flex items-center justify-center mx-auto"><Icon name="Download" className="w-8 h-8 text-[#0066cc]" /></div>
              <p className="text-[#86868b] font-medium text-sm">匯出包含進度與差異的完整報表</p>
              <Button onClick={handleExport} size="lg" className="rounded-2xl w-full sm:w-auto"><Icon name="FileSpreadsheet" className="w-5 h-5 mr-2" /> 產生 Excel</Button>
           </div>
        )}
      </div>
    </Modal>
  );
};

// ============================================================================
// Dashboard
// ============================================================================
const Dashboard = ({ tasks, materials }) => {
  const activeTaskIds = new Set(tasks.map(t => t.id));
  const activeMaterials = materials.filter(m => activeTaskIds.has(m.task_id));

  const totalTasks = tasks.length;
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress').length;
  const totalItems = activeMaterials.length;
  const completedItems = activeMaterials.filter(m => m.counted_qty >= m.target_qty).length;
  const totalCompletionRate = totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);
  const shortMaterials = activeMaterials.filter(m => m.counted_qty > 0 && m.counted_qty < m.target_qty);

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto pb-12 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1d1d1f]">營運總覽</h1>
        <p className="text-[#86868b] text-xs sm:text-sm mt-1.5 font-medium">即時掌握全廠區盤點與備料狀況</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card className="p-5 sm:p-6 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
          <div className="flex justify-between items-start">
            <div><p className="text-xs sm:text-sm font-semibold text-[#86868b] mb-2">活躍任務</p><h3 className="text-3xl sm:text-4xl font-light tracking-tighter text-[#1d1d1f]">{inProgressTasks} <span className="text-lg sm:text-xl font-medium text-[#d2d2d7]">/ {totalTasks}</span></h3></div>
            <div className="p-2.5 sm:p-3 bg-[#0066cc]/10 rounded-2xl"><Icon name="ClipboardList" className="w-5 h-5 sm:w-6 sm:h-6 text-[#0066cc]"/></div>
          </div>
        </Card>
        <Card className="p-5 sm:p-6 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
          <div className="flex justify-between items-start">
            <div><p className="text-xs sm:text-sm font-semibold text-[#86868b] mb-2">整體完成率</p><h3 className="text-3xl sm:text-4xl font-light tracking-tighter text-[#34c759]">{totalCompletionRate}%</h3></div>
            <div className="p-2.5 sm:p-3 bg-[#34c759]/10 rounded-2xl"><Icon name="CheckCircle2" className="w-5 h-5 sm:w-6 sm:h-6 text-[#34c759]"/></div>
          </div>
          <div className="mt-4 sm:mt-5 h-1.5 w-full bg-[#f5f5f7] rounded-full overflow-hidden"><div className="h-full bg-[#34c759] rounded-full transition-all duration-1000 ease-out" style={{ width: `${totalCompletionRate}%`}}></div></div>
        </Card>
        <Card className="p-5 sm:p-6 border-[#ff3b30]/20 bg-[#ff3b30]/[0.02] hover:shadow-[0_8px_30px_rgba(255,59,48,0.08)]">
          <div className="flex justify-between items-start">
            <div><p className="text-xs sm:text-sm font-semibold text-[#ff3b30]/80 mb-2">缺料警示</p><h3 className="text-3xl sm:text-4xl font-light tracking-tighter text-[#ff3b30]">{shortMaterials.length}</h3></div>
            <div className="p-2.5 sm:p-3 bg-[#ff3b30]/10 rounded-2xl"><Icon name="AlertTriangle" className="w-5 h-5 sm:w-6 sm:h-6 text-[#ff3b30]"/></div>
          </div>
        </Card>
        <Card className="p-5 sm:p-6 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
          <div className="flex justify-between items-start">
            <div><p className="text-xs sm:text-sm font-semibold text-[#86868b] mb-2">總管理物料</p><h3 className="text-3xl sm:text-4xl font-light tracking-tighter text-[#1d1d1f]">{activeMaterials.length}</h3></div>
            <div className="p-2.5 sm:p-3 bg-[#af52de]/10 rounded-2xl"><Icon name="Package" className="w-5 h-5 sm:w-6 sm:h-6 text-[#af52de]"/></div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="lg:col-span-2 p-6 sm:p-8">
          <h3 className="text-base sm:text-lg font-semibold tracking-tight mb-5 sm:mb-6 flex items-center text-[#1d1d1f]"><Icon name="Activity" className="w-5 h-5 mr-2 text-[#86868b]"/> 進行中任務</h3>
          <div className="space-y-6 sm:space-y-8">
            {tasks.filter(t => t.status !== 'completed').map(task => {
              const progress = task.progress || 0;
              return (
                <div key={task.id} className="space-y-2.5 sm:space-y-3">
                  <div className="flex justify-between text-xs sm:text-sm items-center">
                    <div className="flex items-center">
                      <span className="font-medium text-[#1d1d1f] truncate max-w-[150px] sm:max-w-none">{task.title}</span>
                      <span className="ml-2 inline-flex items-center text-[10px] font-semibold text-[#86868b] bg-[#f5f5f7] px-1.5 py-0.5 rounded-md border border-[#d2d2d7]/50 shrink-0">{task.materialCount} 項</span>
                    </div>
                    <span className="text-[#86868b] font-semibold">{progress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#f5f5f7] rounded-full overflow-hidden"><div className={`h-full rounded-full transition-all duration-1000 ease-out ${progress === 100 ? 'bg-[#34c759]' : 'bg-[#1d1d1f]'}`} style={{ width: `${progress}%`}}></div></div>
                </div>
              );
            })}
            {tasks.filter(t => t.status !== 'completed').length === 0 && <p className="text-[#86868b] py-8 text-center font-medium text-sm">目前無進行中的任務</p>}
          </div>
        </Card>

        <Card className="flex flex-col h-[350px] sm:h-[420px] overflow-hidden">
          <div className="p-5 sm:p-6 border-b border-[#d2d2d7]/30 flex justify-between items-center bg-white/50 backdrop-blur-md shrink-0">
            <h3 className="text-sm sm:text-base font-semibold tracking-tight text-[#1d1d1f] flex items-center"><Icon name="AlertCircle" className="w-4 h-4 mr-2 text-[#ff3b30]"/> 異常追蹤</h3>
            <Badge className="bg-[#ff3b30]/10 text-[#ff3b30] border-none">{shortMaterials.length}</Badge>
          </div>
          <div className="p-0 overflow-auto flex-1 bg-[#f5f5f7]/30">
            {shortMaterials.length > 0 ? (
              <div className="divide-y divide-[#d2d2d7]/30">
                {shortMaterials.map(m => {
                  const parentTask = tasks.find(t => t.id === m.task_id);
                  return (
                    <div key={m.id} className="p-4 sm:p-5 hover:bg-white transition-colors duration-200">
                      <div className="flex justify-between items-start mb-1.5">
                        <div className="flex items-center truncate mr-2">
                          {m.part_code && <span className="font-bold text-[#1d1d1f] text-xs sm:text-sm mr-1.5">{m.part_code}</span>}
                          <span className="font-semibold text-[#1d1d1f] text-xs sm:text-sm truncate">{m.part_name}</span>
                        </div>
                        <span className="text-[#ff3b30] font-bold text-xs sm:text-sm bg-[#ff3b30]/10 px-2 py-0.5 rounded-md shrink-0">缺 {m.target_qty - m.counted_qty}</span>
                      </div>
                      <p className="text-[10px] sm:text-xs text-[#86868b] truncate mb-2 sm:mb-3 font-medium flex items-center"><span className="mr-1.5 border border-[#d2d2d7] px-1 rounded text-[9px] sm:text-[10px]">ID</span>{m.part_number}</p>
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] sm:text-[10px] bg-[#f5f5f7] px-2 py-1 rounded-md text-[#86868b] font-medium truncate max-w-[120px] sm:max-w-[140px] border border-[#d2d2d7]/50">{parentTask?.title}</span>
                        <span className="text-[10px] sm:text-[11px] text-[#86868b] font-medium truncate ml-2">{m.supplier || '-'}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-[#86868b]">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#34c759]/10 rounded-full flex items-center justify-center mb-3 sm:mb-4"><Icon name="Check" className="w-6 h-6 sm:w-8 sm:h-8 text-[#34c759]" /></div>
                <p className="text-xs sm:text-sm font-medium">目前沒有缺料狀況</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// Settings / Users (Backend Management)
// ============================================================================
const SettingsView = ({ users, isConnected }) => {
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', role: 'operator', password: '' });
  const [editFormData, setEditFormData] = useState(null);
  const [newAdminPassword, setNewAdminPassword] = useState('');

  const handleAddUser = (e) => {
    e.preventDefault();
    if (!isConnected) return showToast('系統未連線，請檢查網路狀態', 'error');
    if(!formData.name || !formData.email || !formData.password) return showToast('請填寫完整資訊', 'error');
    const hashedPwd = hashPassword(formData.password);
    if (users.some(u => u.password === hashedPwd)) return showToast('密碼已被使用，請更換其他密碼', 'error');

    const newRef = db.ref('users').push();
    newRef.set({ id: newRef.key, name: formData.name, email: formData.email, role: formData.role, password: hashedPwd, avatar: formData.name.charAt(0) }).then(() => {
      showToast('人員新增成功', 'success'); setIsAddUserOpen(false); setFormData({ name: '', email: '', role: 'operator', password: '' });
    });
  };

  const handleUpdateUser = (e) => {
    e.preventDefault();
    if (!isConnected) return showToast('系統未連線，請檢查網路狀態', 'error');
    if(!editFormData.name || !editFormData.email) return showToast('請填寫完整資訊', 'error');
    let finalPwd = editFormData.password;
    if (editFormData.newPassword) {
      finalPwd = hashPassword(editFormData.newPassword);
      if (users.some(u => u.id !== editFormData.id && u.password === finalPwd)) return showToast('密碼已被使用，請更換其他密碼', 'error');
    }
    db.ref(`users/${editFormData.id}`).update({ name: editFormData.name, email: editFormData.email, role: editFormData.role, password: finalPwd, avatar: editFormData.name.charAt(0) }).then(() => {
      showToast('人員資料已更新', 'success'); setIsEditUserOpen(false);
    });
  };

  const handleDeleteUser = (id) => {
    if (!isConnected) return showToast('系統未連線，請檢查網路狀態', 'error');
    if(confirm('確定要刪除此人員嗎？')) db.ref(`users/${id}`).remove().then(() => showToast('人員已刪除', 'success'));
  };

  const handleUpdateAdminPassword = (e) => {
    e.preventDefault();
    if (!isConnected) return showToast('系統未連線，請檢查網路狀態', 'error');
    if(!newAdminPassword) return showToast('請輸入新密碼', 'error');
    db.ref('adminPassword').set(newAdminPassword).then(() => { showToast('後台管理密碼已更新', 'success'); setNewAdminPassword(''); });
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-4xl mx-auto animate-in fade-in duration-500 pb-12">
      <div><h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1d1d1f]">後台管理</h1><p className="text-[#86868b] text-xs sm:text-sm mt-1.5 font-medium">系統安全與人員權限設定</p></div>
      <Card className="p-0 overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[#d2d2d7]/30 bg-white/50 flex items-center">
          <div className="w-10 h-10 bg-[#1d1d1f]/5 rounded-xl flex items-center justify-center mr-4 shrink-0"><Icon name="Lock" className="w-5 h-5 text-[#1d1d1f]"/></div>
          <div><h3 className="font-semibold text-[#1d1d1f] tracking-tight text-sm sm:text-base">安全設定</h3><p className="text-[11px] sm:text-xs text-[#86868b] mt-0.5">修改進入此後台的專屬密碼</p></div>
        </div>
        <div className="p-5 sm:p-6 bg-white/30">
          <form onSubmit={handleUpdateAdminPassword} className="flex flex-col sm:flex-row items-start sm:items-end gap-3 sm:gap-4 max-w-md">
            <div className="flex-1 w-full"><Input type="text" value={newAdminPassword} onChange={e => setNewAdminPassword(e.target.value)} placeholder="輸入新密碼..." /></div>
            <Button type="submit" className="w-full sm:w-auto">更新密碼</Button>
          </form>
        </div>
      </Card>
      <Card className="p-0 overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[#d2d2d7]/30 bg-white/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-0">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-[#0066cc]/10 rounded-xl flex items-center justify-center mr-4 shrink-0"><Icon name="Users" className="w-5 h-5 text-[#0066cc]"/></div>
            <div><h3 className="font-semibold text-[#1d1d1f] tracking-tight text-sm sm:text-base">人員權限</h3><p className="text-[11px] sm:text-xs text-[#86868b] mt-0.5">管理系統操作人員與角色</p></div>
          </div>
          <Button size="sm" onClick={() => setIsAddUserOpen(true)} className="rounded-full w-full sm:w-auto"><Icon name="Plus" className="w-4 h-4 mr-1.5"/> 新增人員</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left block md:table">
            <thead className="bg-[#f5f5f7]/50 text-[#86868b] border-b border-[#d2d2d7]/30 hidden md:table-header-group"><tr><th className="px-6 py-4 font-medium">使用者</th><th className="px-6 py-4 font-medium">角色權限</th><th className="px-6 py-4 font-medium text-right">操作</th></tr></thead>
            <tbody className="block md:table-row-group divide-y divide-[#d2d2d7]/30 bg-transparent md:bg-white/30 p-4 md:p-0">
              {users.map(u => (
                <tr key={u.id} className="block md:table-row hover:bg-[#f5f5f7]/50 md:hover:bg-white/80 transition-colors duration-200 bg-white mb-4 md:mb-0 rounded-2xl md:rounded-none p-4 md:p-0 shadow-sm md:shadow-none border border-[#d2d2d7]/30 md:border-none">
                  <td className="flex md:table-cell justify-between items-center px-2 md:px-6 py-3 md:py-4 border-b border-[#f5f5f7] md:border-none">
                    <span className="md:hidden text-xs font-bold text-[#86868b]">使用者</span>
                    <div className="flex items-center space-x-3 md:space-x-4 text-right md:text-left">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-[#f5f5f7] to-[#e5e5ea] border border-[#d2d2d7]/50 flex items-center justify-center font-semibold text-[#1d1d1f] shadow-sm shrink-0">{u.avatar}</div>
                      <div><div className="font-semibold text-[#1d1d1f]">{u.name}</div><div className="text-[11px] md:text-xs text-[#86868b] mt-0.5 font-medium">{u.email}</div></div>
                    </div>
                  </td>
                  <td className="flex md:table-cell justify-between items-center px-2 md:px-6 py-3 md:py-4 border-b border-[#f5f5f7] md:border-none">
                    <span className="md:hidden text-xs font-bold text-[#86868b]">角色權限</span>
                    <Badge className={u.role === 'admin' ? 'bg-[#ff3b30]/10 text-[#ff3b30] border-none' : u.role === 'leader' ? 'bg-[#0066cc]/10 text-[#0066cc] border-none' : 'bg-[#f5f5f7] text-[#86868b] border-none'}>{u.role.toUpperCase()}</Badge>
                  </td>
                  <td className="flex md:table-cell justify-between items-center px-2 md:px-6 py-3 md:py-4 md:text-right">
                    <span className="md:hidden text-xs font-bold text-[#86868b]">操作</span>
                    <div>
                      <button onClick={() => {setEditFormData({...u, newPassword: ''}); setIsEditUserOpen(true);}} className="text-[#0066cc] hover:text-[#005bb5] p-2 rounded-full hover:bg-[#0066cc]/10 transition-colors mr-1"><Icon name="Edit2" className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteUser(u.id)} className="text-[#86868b] hover:text-[#ff3b30] p-2 rounded-full hover:bg-[#ff3b30]/10 transition-colors"><Icon name="Trash2" className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Modal isOpen={isAddUserOpen} onClose={() => setIsAddUserOpen(false)} title="新增人員">
        <form onSubmit={handleAddUser} className="space-y-4 sm:space-y-5">
          <div><label className="block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2">姓名</label><Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required/></div>
          <div><label className="block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2">Email</label><Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required/></div>
          <div><label className="block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2">登入密碼</label><Input type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required/></div>
          <div><label className="block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2">角色權限</label><select className="flex h-11 w-full rounded-xl border border-[#d2d2d7] bg-white/50 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0066cc]/50" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}><option value="operator">Operator</option><option value="leader">Leader</option><option value="admin">Admin</option></select></div>
          <div className="pt-4 sm:pt-6 flex justify-end space-x-3"><Button type="button" variant="secondary" onClick={() => setIsAddUserOpen(false)}>取消</Button><Button type="submit">確認新增</Button></div>
        </form>
      </Modal>
      <Modal isOpen={isEditUserOpen} onClose={() => setIsEditUserOpen(false)} title="編輯人員">
        {editFormData && (
          <form onSubmit={handleUpdateUser} className="space-y-4 sm:space-y-5">
            <div><label className="block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2">姓名</label><Input value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value})} required/></div>
            <div><label className="block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2">Email</label><Input type="email" value={editFormData.email} onChange={e => setEditFormData({...editFormData, email: e.target.value})} required/></div>
            <div><label className="block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2">登入密碼</label><Input type="text" value={editFormData.newPassword || ''} onChange={e => setEditFormData({...editFormData, newPassword: e.target.value})} placeholder="若不修改請留空" /></div>
            <div><label className="block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2">角色權限</label><select className="flex h-11 w-full rounded-xl border border-[#d2d2d7] bg-white/50 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0066cc]/50" value={editFormData.role} onChange={e => setEditFormData({...editFormData, role: e.target.value})}><option value="operator">Operator</option><option value="leader">Leader</option><option value="admin">Admin</option></select></div>
            <div className="pt-4 sm:pt-6 flex justify-end space-x-3"><Button type="button" variant="secondary" onClick={() => setIsEditUserOpen(false)}>取消</Button><Button type="submit">儲存變更</Button></div>
          </form>
        )}
      </Modal>
    </div>
  )
}

// ============================================================================
// Sidebar & TaskList
// ============================================================================
const Sidebar = ({ activeTab, onTabChange, currentUser, onLogout, loginMode, isOpen, onClose, isDesktopOpen }) => {
  const menuItems = [
    { id: 'dashboard', icon: 'LayoutDashboard', label: '營運總覽', roles: ['admin', 'leader'] },
    { id: 'vehicles', icon: 'Car', label: '車型管理', roles: ['admin', 'leader', 'operator'] },
    { id: 'tasks', icon: 'ClipboardList', label: '任務管理', roles: ['admin', 'leader', 'operator'] },
    { id: 'settings', icon: 'Settings', label: '後台管理', roles: ['admin'] },
  ];
  let visibleMenus = menuItems.filter(m => m.roles.includes(currentUser.role));
  if (loginMode === 'admin') visibleMenus = visibleMenus.filter(m => m.id === 'settings');

  return (
    <aside className={`fixed inset-y-0 left-0 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 ${isDesktopOpen ? 'md:ml-0' : 'md:-ml-64'} transition-all duration-300 ease-in-out w-64 bg-white/80 backdrop-blur-3xl border-r border-[#d2d2d7]/50 flex flex-col z-50 shadow-[4px_0_24px_rgba(0,0,0,0.02)]`}>
      <div className="h-16 sm:h-20 flex items-center justify-between px-6 sm:px-8 border-b border-[#d2d2d7]/30 shrink-0">
        <div className="flex items-center"><img src="./logo.png" onError={(e) => { e.target.onerror = null; e.target.src = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/CMC_logo.svg/320px-CMC_logo.svg.png'; }} alt="CMC Logo" className="h-8 w-auto object-contain mr-3 drop-shadow-sm" /><span className="font-semibold text-lg tracking-tight text-[#1d1d1f]">INV System</span></div>
        <button onClick={onClose} className="md:hidden text-[#86868b] hover:text-[#1d1d1f] p-2 -mr-2 rounded-full hover:bg-[#f5f5f7]"><Icon name="X" className="w-5 h-5" /></button>
      </div>
      <nav className="flex-1 py-6 px-4 overflow-y-auto">
        <div className="text-xs font-semibold text-[#86868b] mb-4 px-4 tracking-wider uppercase">選單</div>
        <ul className="space-y-1.5">
          {visibleMenus.map(item => (
            <li key={item.id}><button onClick={() => { onTabChange(item.id); onClose(); }} className={`w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 ease-out ${activeTab === item.id ? 'bg-[#1d1d1f] text-white shadow-md' : 'text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]'}`}><Icon name={item.icon} className={`w-5 h-5 mr-3 ${activeTab === item.id ? 'opacity-100' : 'opacity-70'}`} /><span className="font-medium text-sm">{item.label}</span></button></li>
          ))}
          <li className="pt-4 mt-4 border-t border-[#d2d2d7]/30"><a href="https://plm.china-motor.com.tw/3dpassport/login?service=https%3A%2F%2Fplm.china-motor.com.tw%2F3dspace%2F" target="_blank" rel="noopener noreferrer" className="w-full flex items-center px-4 py-3 rounded-xl transition-all duration-200 ease-out text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"><Icon name="Box" className="w-5 h-5 mr-3 opacity-70" /><span className="font-medium text-sm">3DEXPERIENCE</span><Icon name="ExternalLink" className="w-3 h-3 ml-auto opacity-50" /></a></li>
        </ul>
      </nav>
      <div className="p-5 sm:p-6 border-t border-[#d2d2d7]/30 relative bg-white/30 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f5f5f7] to-[#e5e5ea] border border-[#d2d2d7]/50 flex items-center justify-center text-sm font-semibold text-[#1d1d1f] shadow-sm cursor-pointer shrink-0">{currentUser.avatar}</div>
          <div className="flex-1 cursor-pointer overflow-hidden"><div className="text-sm font-semibold text-[#1d1d1f] truncate">{currentUser.name}</div><div className="text-[11px] text-[#86868b] font-medium uppercase tracking-wider mt-0.5">{currentUser.role}</div></div>
          <button onClick={onLogout} title="登出系統" className="p-2 hover:bg-[#f5f5f7] rounded-full transition-colors shrink-0"><Icon name="LogOut" className="w-4 h-4 text-[#86868b] hover:text-[#1d1d1f]" /></button>
        </div>
      </div>
    </aside>
  );
};

const TaskList = ({ tasks, materials, onSelectTask, currentUser, users, isConnected }) => {
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isEditTaskOpen, setIsEditTaskOpen] = useState(false);
  const [editTaskData, setEditTaskData] = useState(null);
  const [accessModalTask, setAccessModalTask] = useState(null);
  const [formData, setFormData] = useState({ title: '', description: '', due_date: '' });

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!isConnected) return showToast('系統未連線，請檢查網路狀態', 'error');
    if(!formData.title) return showToast('請填寫任務標題', 'error');
    const newRef = db.ref('tasks').push();
    newRef.set({ id: newRef.key, title: formData.title, description: formData.description, due_date: formData.due_date || new Date().toISOString().split('T')[0], status: 'pending', progress: 0, type: 'warehouse', created_at: new Date().toISOString().split('T')[0], owner_id: currentUser.id, allowed_users: [currentUser.id] }).then(() => {
      showToast('任務新增成功', 'success'); setIsAddTaskOpen(false); setFormData({ title: '', description: '', due_date: '' });
    });
  };

  const handleUpdateTask = (e) => {
    e.preventDefault();
    if (!isConnected) return showToast('系統未連線，請檢查網路狀態', 'error');
    if (!editTaskData.title) return showToast('請填寫任務標題', 'error');
    const originalTask = tasks.find(t => t.id === editTaskData.id);
    const diffs = [];
    if (originalTask.title !== editTaskData.title) diffs.push({ field: '任務標題', old: originalTask.title, new: editTaskData.title });
    if (originalTask.description !== editTaskData.description) diffs.push({ field: '任務描述', old: originalTask.description, new: editTaskData.description });
    if (originalTask.due_date !== editTaskData.due_date) diffs.push({ field: '到期日', old: originalTask.due_date, new: editTaskData.due_date });

    if (diffs.length > 0) {
      db.ref(`tasks/${editTaskData.id}`).update({ title: editTaskData.title, description: editTaskData.description, due_date: editTaskData.due_date }).then(() => {
        db.ref('audit_logs').push({ task_id: editTaskData.id, action: 'UPDATE', action_label: '編輯任務', entity_name: editTaskData.title, changes: diffs, user_name: currentUser.name, timestamp: new Date().toISOString() });
        showToast('任務更新成功', 'success'); setIsEditTaskOpen(false);
      });
    } else setIsEditTaskOpen(false);
  };

  const handleDeleteTask = (e, id) => {
    e.stopPropagation();
    if (!isConnected) return showToast('系統未連線，請檢查網路狀態', 'error');
    if(confirm('確定要刪除此任務嗎？（相關物料將一併刪除）')) {
      const updates = {}; updates[`tasks/${id}`] = null;
      materials.filter(m => m.task_id === id).forEach(m => updates[`materials/${m.id}`] = null);
      db.ref().update(updates).then(() => showToast('任務及相關物料已刪除', 'success'));
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1d1d1f]">任務管理</h1><p className="text-[#86868b] text-xs sm:text-sm mt-1.5 font-medium">建立與管理所有的盤點與清點任務</p></div>
        {currentUser.role === 'admin' && <Button onClick={() => setIsAddTaskOpen(true)} className="w-full sm:w-auto"><Icon name="Plus" className="w-4 h-4 mr-2" /> 新增任務</Button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        {tasks.map((task) => (
          <Card key={task.id} className="hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 cursor-pointer group border-transparent hover:border-[#d2d2d7]/50" >
            <div className="p-5 sm:p-6 flex flex-col h-full" onClick={() => onSelectTask(task.id)}>
              <div className="flex justify-between items-start mb-4 sm:mb-5">
                <Badge className={task.status === 'in_progress' ? 'bg-[#0066cc]/10 text-[#0066cc] border-none' : task.status === 'pending' ? 'bg-[#ff9500]/10 text-[#ff9500] border-none' : 'bg-[#34c759]/10 text-[#34c759] border-none'}>
                  {task.status === 'in_progress' ? '進行中' : task.status === 'pending' ? '未開始' : '已完成'}
                </Badge>
                <div className="flex items-center opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all duration-200">
                  { (task.owner_id === currentUser.id) && <button onClick={(e) => { e.stopPropagation(); setAccessModalTask(task); }} className="text-[#86868b] hover:text-[#0066cc] p-1.5 rounded-full hover:bg-[#0066cc]/10 mr-1" title="權限管理"><Icon name="Users" className="w-4 h-4" /></button>}
                  { (task.owner_id === currentUser.id) && <button onClick={(e) => { e.stopPropagation(); setEditTaskData(task); setIsEditTaskOpen(true); }} className="text-[#86868b] hover:text-[#0066cc] p-1.5 rounded-full hover:bg-[#0066cc]/10 mr-1" title="編輯任務"><Icon name="Edit2" className="w-4 h-4" /></button>}
                  { (task.owner_id === currentUser.id) && <button onClick={(e) => handleDeleteTask(e, task.id)} className="text-[#86868b] hover:text-[#ff3b30] p-1.5 rounded-full hover:bg-[#ff3b30]/10" title="刪除任務"><Icon name="Trash2" className="w-4 h-4" /></button>}
                </div>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold tracking-tight mb-1.5 text-[#1d1d1f]">{task.title}</h3>
              <div className="mb-3 flex items-center gap-2"><span className="inline-flex items-center text-[10px] sm:text-[11px] font-semibold text-[#86868b] bg-[#f5f5f7] px-2 py-1 rounded-md border border-[#d2d2d7]/50"><Icon name="Package" className="w-3 h-3 mr-1.5 opacity-70" />共 {task.materialCount} 項</span></div>
              <p className="text-[#86868b] text-xs sm:text-sm line-clamp-2 mb-5 sm:mb-6 flex-1 leading-relaxed">{task.description}</p>
              <div className="space-y-2 sm:space-y-2.5 mb-5 sm:mb-6 shrink-0">
                <div className="flex justify-between text-[10px] sm:text-xs font-semibold text-[#86868b] uppercase tracking-wider"><span>進度</span><span className={task.progress === 100 ? 'text-[#34c759]' : 'text-[#1d1d1f]'}>{task.progress}%</span></div>
                <div className="w-full bg-[#f5f5f7] rounded-full h-1.5 overflow-hidden"><div className={`h-full rounded-full transition-all duration-1000 ease-out ${task.progress === 100 ? 'bg-[#34c759]' : 'bg-[#1d1d1f]'}`} style={{ width: `${task.progress}%` }}></div></div>
              </div>
              <div className="flex justify-between items-center text-[10px] sm:text-xs font-medium text-[#86868b] pt-4 sm:pt-5 border-t border-[#d2d2d7]/30 shrink-0">
                <span className="flex items-center"><Icon name="Calendar" className="w-3.5 h-3.5 mr-1.5 opacity-70"/> {task.due_date}</span>
                <span className="flex items-center text-[#1d1d1f] font-semibold lg:group-hover:text-[#0066cc] transition-colors bg-[#f5f5f7] lg:group-hover:bg-[#0066cc]/10 px-3 py-1.5 rounded-full">進入任務 <Icon name="ArrowRight" className="w-3.5 h-3.5 ml-1.5" /></span>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Modal isOpen={isAddTaskOpen} onClose={() => setIsAddTaskOpen(false)} title="新增任務">
        <form onSubmit={handleAddTask} className="space-y-4 sm:space-y-5">
          <div><label className="block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2">任務標題</label><Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required /></div>
          <div><label className="block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2">任務描述</label><Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
          <div><label className="block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2">到期日</label><Input type="date" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} /></div>
          <div className="pt-4 sm:pt-6 flex justify-end space-x-3"><Button type="button" variant="secondary" onClick={() => setIsAddTaskOpen(false)}>取消</Button><Button type="submit">確認新增</Button></div>
        </form>
      </Modal>
      <Modal isOpen={isEditTaskOpen} onClose={() => setIsEditTaskOpen(false)} title="編輯任務">
        {editTaskData && (
          <form onSubmit={handleUpdateTask} className="space-y-4 sm:space-y-5">
            <div><label className="block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2">任務標題</label><Input value={editTaskData.title} onChange={e => setEditTaskData({...editTaskData, title: e.target.value})} required /></div>
            <div><label className="block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2">任務描述</label><Input value={editTaskData.description} onChange={e => setEditTaskData({...editTaskData, description: e.target.value})} /></div>
            <div><label className="block text-xs sm:text-sm font-semibold mb-1.5 sm:mb-2">到期日</label><Input type="date" value={editTaskData.due_date} onChange={e => setEditTaskData({...editTaskData, due_date: e.target.value})} /></div>
            <div className="pt-4 sm:pt-6 flex justify-end space-x-3"><Button type="button" variant="secondary" onClick={() => setIsEditTaskOpen(false)}>取消</Button><Button type="submit">儲存變更</Button></div>
          </form>
        )}
      </Modal>
      <TaskAccessModal isOpen={!!accessModalTask} onClose={() => setAccessModalTask(null)} task={accessModalTask} users={users} currentUser={currentUser} isConnected={isConnected} />
    </div>
  );
};

// ============================================================================
// Material Management (Task)
// ============================================================================
const MaterialManagement = ({ task, materials, onBack, onCount, onImportSuccess, currentUser, auditLogs, isConnected }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false);
  const [isEditMaterialOpen, setIsEditMaterialOpen] = useState(false);
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);
  const [isCopyToVehicleOpen, setIsCopyToVehicleOpen] = useState(false);
  const [isBatchEditOpen, setIsBatchEditOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [viewRemarkMaterial, setViewRemarkMaterial] = useState(null);
  const [editFormData, setEditFormData] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  
  const [formData, setFormData] = useState({ part_number: '', part_code: '', part_name: '', part_name_zh: '', target_qty: '', usage_per_unit: '1', supplier: '', category: '', location: '', remark: '', tags: '' });
  const canEdit = ['admin', 'leader'].includes(currentUser.role);

  const processedMaterials = useMemo(() => {
    let result = materials.filter((m) => {
      const matchesSearch = m.part_number.toLowerCase().includes(searchTerm.toLowerCase()) || m.part_name.toLowerCase().includes(searchTerm.toLowerCase()) || (m.part_name_zh && m.part_name_zh.toLowerCase().includes(searchTerm.toLowerCase())) || (m.part_code && m.part_code.toLowerCase().includes(searchTerm.toLowerCase()));
      let matchesFilter = true;
      if (filterType === 'completed') matchesFilter = m.counted_qty >= m.target_qty;
      if (filterType === 'incomplete') matchesFilter = m.counted_qty < m.target_qty;
      if (filterType === 'excess') matchesFilter = m.counted_qty > m.target_qty;
      if (filterType === 'shortage') matchesFilter = m.counted_qty > 0 && m.counted_qty < m.target_qty;
      return matchesSearch && matchesFilter;
    });
    if (sortConfig.key) {
      result.sort((a, b) => {
        let aVal = a[sortConfig.key]; let bVal = b[sortConfig.key];
        if (sortConfig.key === 'diff') { aVal = a.counted_qty - a.target_qty; bVal = b.counted_qty - b.target_qty; }
        if (typeof aVal === 'string') return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [materials, searchTerm, filterType, sortConfig]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) setSelectedIds(processedMaterials.map(m => m.id));
    else setSelectedIds([]);
  };

  const handleSelectOne = (id) => {
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(i => i !== id));
    else setSelectedIds([...selectedIds, id]);
  };

  const handleBatchDelete = () => {
    if (!isConnected) return showToast('系統未連線', 'error');
    if (confirm(`確定要刪除選取的 ${selectedIds.length} 筆物料嗎？`)) {
      const updates = {};
      selectedIds.forEach(id => updates[`materials/${id}`] = null);
      db.ref().update(updates).then(() => {
        db.ref('audit_logs').push({ task_id: task.id, action: 'DELETE', action_label: '批次刪除', entity_name: `共 ${selectedIds.length} 筆`, changes: [], user_name: currentUser.name, timestamp: new Date().toISOString() });
        showToast('批次刪除成功', 'success'); setSelectedIds([]);
      });
    }
  };

  const handleBatchEditApply = (field, value) => {
    if (!isConnected) return showToast('系統未連線', 'error');
    const updates = {};
    selectedIds.forEach(id => {
      let finalValue = value;
      if (field === 'target_qty' || field === 'usage_per_unit') finalValue = Number(value) || 0;
      if (field === 'tags') finalValue = value ? value.split(',').map(t => ({ name: t.trim(), color: 'bg-[#f5f5f7] text-[#1d1d1f]' })) : [];
      updates[`materials/${id}/${field}`] = finalValue;
    });
    db.ref().update(updates).then(() => {
      db.ref('audit_logs').push({ task_id: task.id, action: 'UPDATE', action_label: '批次編輯', entity_name: `共 ${selectedIds.length} 筆`, changes: [{field, old: '多筆資料', new: value}], user_name: currentUser.name, timestamp: new Date().toISOString() });
      showToast('批次編輯成功', 'success'); setSelectedIds([]);
    });
  };

  const handleBatchExport = () => {
    const XLSX = window.XLSX;
    if (!XLSX) return showToast("Excel 模組尚未載入", "error");
    const exportData = processedMaterials.filter(m => selectedIds.includes(m.id)).map(m => ({
      "UPG": m.part_number, "件號": m.part_code || '', "件名": m.part_name, "中文件名": m.part_name_zh || '', "單位": m.unit, "單台用量": m.usage_per_unit || 1, "目標數量": m.target_qty, "已清點數量": m.counted_qty, "差異數量": m.counted_qty - m.target_qty, "狀態": m.counted_qty >= m.target_qty ? '已完成' : (m.counted_qty > 0 ? '清點中' : '未清點'), "廠商": m.supplier || '', "零件分類": m.category || '', "儲位": m.location || '', "標籤": (m.tags || []).map(t => t.name).join(','), "備註": m.remark || ''
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "批次匯出");
    XLSX.writeFile(wb, `[批次匯出]_結果.xlsx`);
    showToast("匯出成功", "success");
  };

  const handleBatchPrint = () => {
    const printWindow = window.open('', '_blank');
    const mats = processedMaterials.filter(m => selectedIds.includes(m.id));
    printWindow.document.write('<html><head><title>列印物料清單</title><style>body{font-family:sans-serif;} table {width: 100%; border-collapse: collapse; margin-top:20px;} th, td {border: 1px solid #ddd; padding: 8px; text-align: left;} th{background-color:#f5f5f7;}</style></head><body><h2>物料清單</h2><table><thead><tr><th>UPG</th><th>件名</th><th>儲位</th><th>目標數量</th></tr></thead><tbody>');
    mats.forEach(m => printWindow.document.write(`<tr><td>${m.part_number}</td><td>${m.part_name}</td><td>${m.location||'-'}</td><td>${m.target_qty}</td></tr>`));
    printWindow.document.write('</tbody></table></body></html>');
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const handleBatchShare = () => {
    const mats = processedMaterials.filter(m => selectedIds.includes(m.id));
    const text = mats.map(m => `[${m.location||'無儲位'}] ${m.part_number} - ${m.part_name} (需 ${m.target_qty})`).join('\n');
    navigator.clipboard.writeText(text).then(() => showToast('已複製清單至剪貼簿', 'success'));
  };

  const handleAddMaterial = (e) => {
    e.preventDefault();
    if (!isConnected) return showToast('系統未連線', 'error');
    if(!formData.part_number || !formData.target_qty) return showToast('UPG 與目標數量為必填', 'error');
    const parsedTags = formData.tags.split(',').map(t => t.trim()).filter(t => t).map(tagName => {
        const existing = MOCK_TAGS.find(mt => mt.name === tagName);
        return existing || { id: 'tag-'+Math.random().toString(36).substr(2,5), name: tagName, color: 'bg-[#f5f5f7] text-[#1d1d1f] border-none' };
    });
    const newRef = db.ref('materials').push();
    newRef.set({ id: newRef.key, task_id: task.id, part_number: formData.part_number, part_code: formData.part_code, part_name: formData.part_name, part_name_zh: formData.part_name_zh || '', target_qty: Number(formData.target_qty), usage_per_unit: Number(formData.usage_per_unit) || 1, supplier: formData.supplier, category: formData.category, location: formData.location || '', remark: formData.remark || '', counted_qty: 0, status: 'pending', unit: 'PCS', tags: parsedTags }).then(() => {
      db.ref('audit_logs').push({ task_id: task.id, action: 'CREATE', action_label: '新增物料', entity_name: formData.part_name || formData.part_number, changes: [{ field: 'UPG', old: '', new: formData.part_number }, { field: '目標數量', old: '', new: formData.target_qty }], user_name: currentUser.name, timestamp: new Date().toISOString() });
      showToast('物料新增成功', 'success'); setIsAddMaterialOpen(false); setFormData({ part_number: '', part_code: '', part_name: '', part_name_zh: '', target_qty: '', usage_per_unit: '1', supplier: '', category: '', location: '', remark: '', tags: '' });
    });
  };

  const handleUpdateMaterial = (e) => {
    e.preventDefault();
    if (!isConnected) return showToast('系統未連線', 'error');
    if(!editFormData.part_number || !editFormData.target_qty) return showToast('UPG 與目標數量為必填', 'error');
    const parsedTags = typeof editFormData.tags === 'string' ? editFormData.tags.split(',').map(t => t.trim()).filter(t => t).map(tagName => {
        const existing = MOCK_TAGS.find(mt => mt.name === tagName);
        return existing || { id: 'tag-'+Math.random().toString(36).substr(2,5), name: tagName, color: 'bg-[#f5f5f7] text-[#1d1d1f] border-none' };
    }) : editFormData.tags;
    db.ref(`materials/${editFormData.id}`).update({ ...editFormData, target_qty: Number(editFormData.target_qty), usage_per_unit: Number(editFormData.usage_per_unit) || 1, tags: parsedTags }).then(() => {
      db.ref('audit_logs').push({ task_id: task.id, action: 'UPDATE', action_label: '編輯物料', entity_name: editFormData.part_name || editFormData.part_number, changes: [], user_name: currentUser.name, timestamp: new Date().toISOString() });
      showToast('物料更新成功', 'success'); setIsEditMaterialOpen(false);
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-[1600px] mx-auto flex flex-col h-[calc(100vh-3rem)] animate-in fade-in duration-300 relative">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <button onClick={onBack} className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-white border border-[#d2d2d7]/50 shadow-sm hover:bg-[#f5f5f7] transition-colors text-[#1d1d1f] shrink-0"><Icon name="ArrowLeft" className="w-4 h-4 sm:w-5 sm:h-5" /></button>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#1d1d1f] flex items-center line-clamp-1">{task.title}</h1>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
              <Badge className="bg-[#1d1d1f]/5 text-[#1d1d1f] border-none">總數: {totalCount}</Badge>
              <Badge className="bg-[#34c759]/10 text-[#34c759] border-none">已完成: {completedCount}</Badge>
              <Badge className="bg-[#ff9500]/10 text-[#ff9500] border-none">未完成: {incompleteCount}</Badge>
            </div>
          </div>
        </div>
        <div className="flex space-x-2 sm:space-x-3 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <Button variant="outline" onClick={() => setIsAuditLogOpen(true)} className="flex-1 sm:flex-none whitespace-nowrap bg-white"><Icon name="History" className="w-4 h-4 mr-1.5 sm:mr-2 text-[#86868b]" /> <span className="hidden sm:inline">操作紀錄</span><span className="sm:hidden">紀錄</span></Button>
          {canEdit && (
            <>
              <Button variant="secondary" onClick={() => setIsExcelModalOpen(true)} className="flex-1 sm:flex-none whitespace-nowrap"><Icon name="FileSpreadsheet" className="w-4 h-4 mr-1.5 sm:mr-2 text-[#34c759]" /> <span className="hidden sm:inline">Excel 作業</span><span className="sm:hidden">Excel</span></Button>
              <Button onClick={() => setIsAddMaterialOpen(true)} className="flex-1 sm:flex-none whitespace-nowrap"><Icon name="Plus" className="w-4 h-4 mr-1.5 sm:mr-2" /> 新增物料</Button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 shrink-0">
        <div className="relative flex-1 max-w-full sm:max-w-md">
          <Icon name="Search" className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
          <Input placeholder="搜尋UPG、件號、件名..." className="pl-11 bg-white shadow-sm border-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
        </div>
        <select className="flex h-11 rounded-xl border border-[#d2d2d7] bg-white px-4 py-2 text-sm text-[#1d1d1f] shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0066cc]/10 focus-visible:border-[#0066cc] transition-all cursor-pointer w-full sm:w-auto" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="all">全部狀態</option><option value="completed">已完成</option><option value="incomplete">未完成</option><option value="excess">過量</option><option value="shortage">少缺</option>
        </select>
      </div>

      <Card className="flex-1 overflow-hidden p-0 rounded-2xl sm:rounded-3xl border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-transparent lg:bg-white">
        <div className="overflow-auto h-full pb-24">
          <table className="w-full text-sm text-left whitespace-normal lg:whitespace-nowrap block lg:table">
            <thead className="bg-[#f5f5f7]/80 backdrop-blur-xl text-[#86868b] sticky top-0 z-10 border-b border-[#d2d2d7]/30 hidden lg:table-header-group">
              <tr>
                <th className="px-4 py-4 w-10 text-center"><input type="checkbox" className="rounded border-[#d2d2d7] text-[#0066cc] focus:ring-[#0066cc]" checked={selectedIds.length === processedMaterials.length && processedMaterials.length > 0} onChange={handleSelectAll} /></th>
                <th className="px-4 py-4 font-semibold tracking-wide w-12">狀態</th>
                <th className="px-4 py-4 font-semibold tracking-wide min-w-[220px] cursor-pointer hover:bg-[#d2d2d7]/30 transition-colors" onClick={() => handleSort('part_number')}><div className="flex items-center">件號 / 件名 (UPG){sortConfig.key === 'part_number' && <Icon name={sortConfig.direction === 'asc' ? 'ChevronUp' : 'ChevronDown'} className="w-4 h-4 ml-1" />}</div></th>
                <th className="px-4 py-4 font-semibold tracking-wide w-24">分類</th>
                <th className="px-4 py-4 font-semibold tracking-wide w-24">廠商</th>
                <th className="px-4 py-4 font-semibold tracking-wide w-24">儲位</th>
                <th className="px-4 py-4 font-semibold tracking-wide text-center w-20">單台用量</th>
                <th className="px-4 py-4 font-semibold tracking-wide text-center w-20">目標</th>
                <th className="px-4 py-4 font-semibold tracking-wide text-center w-20 cursor-pointer hover:bg-[#d2d2d7]/30 transition-colors" onClick={() => handleSort('counted_qty')}><div className="flex items-center justify-center">已清點{sortConfig.key === 'counted_qty' && <Icon name={sortConfig.direction === 'asc' ? 'ChevronUp' : 'ChevronDown'} className="w-4 h-4 ml-1" />}</div></th>
                <th className="px-4 py-4 font-semibold tracking-wide text-center w-20 cursor-pointer hover:bg-[#d2d2d7]/30 transition-colors" onClick={() => handleSort('diff')}><div className="flex items-center justify-center">差異{sortConfig.key === 'diff' && <Icon name={sortConfig.direction === 'asc' ? 'ChevronUp' : 'ChevronDown'} className="w-4 h-4 ml-1" />}</div></th>
                <th className="px-4 py-4 font-semibold tracking-wide text-center w-32">標籤</th>
                <th className="px-4 py-4 font-semibold tracking-wide text-right sticky right-0 bg-[#f5f5f7]/80 backdrop-blur-xl shadow-[-10px_0_15px_-10px_rgba(0,0,0,0.05)] w-36">操作</th>
              </tr>
            </thead>
            <tbody className="block lg:table-row-group divide-y divide-[#d2d2d7]/30 bg-transparent lg:bg-white/30 p-2 lg:p-0">
              {processedMaterials.map((mat) => {
                const diff = mat.counted_qty - mat.target_qty;
                const isShort = diff < 0 && mat.counted_qty > 0;
                const isDone = mat.counted_qty >= mat.target_qty;
                const isSelected = selectedIds.includes(mat.id);
                
                return (
                  <tr key={mat.id} className={`block lg:table-row transition-colors duration-200 group bg-white mb-4 lg:mb-0 rounded-2xl lg:rounded-none p-4 lg:p-0 shadow-sm lg:shadow-none border border-[#d2d2d7]/50 lg:border-none relative ${isSelected ? 'bg-[#0066cc]/5' : 'hover:bg-[#f5f5f7]/50'}`}>
                    <td className="px-4 py-4 hidden lg:table-cell text-center"><input type="checkbox" className="rounded border-[#d2d2d7] text-[#0066cc] focus:ring-[#0066cc]" checked={isSelected} onChange={() => handleSelectOne(mat.id)} /></td>
                    <td className="flex lg:table-cell justify-between items-center px-2 lg:px-4 py-2.5 lg:py-4 border-b border-[#f5f5f7] lg:border-none">
                      <span className="lg:hidden flex items-center gap-2"><input type="checkbox" className="rounded border-[#d2d2d7] text-[#0066cc] focus:ring-[#0066cc]" checked={isSelected} onChange={() => handleSelectOne(mat.id)} /><span className="text-xs font-bold text-[#86868b] uppercase tracking-wider">狀態</span></span>
                      <div className={`w-2.5 h-2.5 rounded-full ${isDone ? 'bg-[#34c759] shadow-[0_0_8px_rgba(52,199,89,0.4)]' : (mat.counted_qty > 0 ? 'bg-[#0066cc] shadow-[0_0_8px_rgba(0,102,204,0.4)]' : 'bg-[#d2d2d7]')}`} />
                    </td>
                    <td className="flex lg:table-cell flex-col lg:flex-row items-start lg:items-center px-2 lg:px-4 py-3 lg:py-4 border-b border-[#f5f5f7] lg:border-none max-w-full lg:max-w-[280px] truncate">
                      <span className="lg:hidden text-xs font-bold text-[#86868b] uppercase tracking-wider mb-1.5">件號 / 件名</span>
                      <div className="w-full">
                        <div className="flex items-center truncate mb-1.5">
                          {mat.part_code && <span className="bg-[#1d1d1f] text-white px-2.5 py-1 rounded-lg text-xs font-bold tracking-wider mr-2.5 shadow-sm shrink-0">{mat.part_code}</span>}
                          <span className="font-bold text-[#1d1d1f] text-base sm:text-lg tracking-tight truncate">{mat.part_name} {mat.part_name_zh && <span className="ml-1">{mat.part_name_zh}</span>}</span>
                          {mat.remark && <button onClick={() => setViewRemarkMaterial(mat)} className="ml-2 text-[#ff9500] hover:text-[#ff3b30] transition-colors shrink-0" title="查看備註"><Icon name="MessageSquareText" className="w-5 h-5" /></button>}
                        </div>
                        <div className="text-[#86868b] text-xs truncate font-medium flex items-center"><span className="mr-1.5 border border-[#d2d2d7] px-1.5 py-0.5 rounded text-[10px] text-[#86868b] font-bold">UPG</span>{mat.part_number}</div>
                      </div>
                    </td>
                    <td className="flex lg:table-cell justify-between items-center px-2 lg:px-4 py-2.5 lg:py-4 border-b border-[#f5f5f7] lg:border-none"><span className="lg:hidden text-xs font-bold text-[#86868b] uppercase tracking-wider">分類</span><span className="text-[#86868b] font-medium truncate">{mat.category || '-'}</span></td>
                    <td className="flex lg:table-cell justify-between items-center px-2 lg:px-4 py-2.5 lg:py-4 border-b border-[#f5f5f7] lg:border-none"><span className="lg:hidden text-xs font-bold text-[#86868b] uppercase tracking-wider">廠商</span><span className="text-[#86868b] font-medium truncate">{mat.supplier || '-'}</span></td>
                    <td className="flex lg:table-cell justify-between items-center px-2 lg:px-4 py-2.5 lg:py-4 border-b border-[#f5f5f7] lg:border-none"><span className="lg:hidden text-xs font-bold text-[#86868b] uppercase tracking-wider">儲位</span><span className="text-[#1d1d1f] font-semibold truncate">{mat.location || '-'}</span></td>
                    <td className="flex lg:table-cell justify-between items-center px-2 lg:px-4 py-2.5 lg:py-4 border-b border-[#f5f5f7] lg:border-none"><span className="lg:hidden text-xs font-bold text-[#86868b] uppercase tracking-wider">單台用量</span><span className="text-center font-semibold text-[#1d1d1f]">{mat.usage_per_unit || 1}</span></td>
                    <td className="flex lg:table-cell justify-between items-center px-2 lg:px-4 py-2.5 lg:py-4 border-b border-[#f5f5f7] lg:border-none"><span className="lg:hidden text-xs font-bold text-[#86868b] uppercase tracking-wider">目標</span><span className="text-center font-semibold text-[#1d1d1f]">{mat.target_qty}</span></td>
                    <td className="flex lg:table-cell justify-between items-center px-2 lg:px-4 py-2.5 lg:py-4 border-b border-[#f5f5f7] lg:border-none"><span className="lg:hidden text-xs font-bold text-[#86868b] uppercase tracking-wider">已清點</span><span className={`font-bold text-base ${mat.counted_qty > 0 ? 'text-[#0066cc]' : 'text-[#86868b]'}`}>{mat.counted_qty}</span></td>
                    <td className="flex lg:table-cell justify-between items-center px-2 lg:px-4 py-2.5 lg:py-4 border-b border-[#f5f5f7] lg:border-none"><span className="lg:hidden text-xs font-bold text-[#86868b] uppercase tracking-wider">差異</span><span className={`font-bold text-base ${isShort ? 'text-[#ff3b30]' : diff > 0 ? 'text-[#ff9500]' : 'text-[#86868b]'}`}>{diff > 0 ? '+' : ''}{diff}</span></td>
                    <td className="flex lg:table-cell justify-between items-center px-2 lg:px-4 py-2.5 lg:py-4 border-b border-[#f5f5f7] lg:border-none"><span className="lg:hidden text-xs font-bold text-[#86868b] uppercase tracking-wider">標籤</span><div className="flex flex-wrap justify-end lg:justify-center gap-1.5">{mat.tags?.map(tag => <Badge key={tag.id} className={tag.color}>{tag.name}</Badge>)}</div></td>
                    <td className="flex lg:table-cell justify-between items-center px-2 lg:px-4 py-3 lg:py-4 lg:text-right lg:sticky lg:right-0 lg:bg-white group-hover:bg-[#f5f5f7]/50 transition-colors lg:shadow-[-10px_0_15px_-10px_rgba(0,0,0,0.02)]">
                      <span className="lg:hidden text-xs font-bold text-[#86868b] uppercase tracking-wider">操作</span>
                      <div className="flex items-center justify-end space-x-2">
                        <button onClick={() => onCount(mat.id)} className="bg-[#0066cc] text-white hover:bg-[#005bb5] transition-all duration-300 font-bold text-sm rounded-full px-4 py-2 shadow-[0_4px_12px_rgba(0,102,204,0.3)] active:scale-95 flex items-center"><Icon name="Edit3" className="w-4 h-4 mr-1.5" /> 清點</button>
                        {canEdit && (
                          <>
                            <button onClick={() => {setEditFormData({...mat, tags: (mat.tags||[]).map(t=>t.name).join(',')}); setIsEditMaterialOpen(true);}} className="text-[#86868b] hover:text-[#0066cc] transition-colors p-2 rounded-full hover:bg-[#0066cc]/10"><Icon name="Edit2" className="w-4 h-4" /></button>
                            <button onClick={() => setDeleteConfirmId(mat.id)} className="text-[#86868b] hover:text-[#ff3b30] transition-colors p-2 rounded-full hover:bg-[#ff3b30]/10"><Icon name="Trash2" className="w-4 h-4" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Batch Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1d1d1f]/90 backdrop-blur-xl text-white px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-4 z-50 animate-in slide-in-from-bottom-10 border border-white/10">
          <span className="font-bold text-sm whitespace-nowrap">{selectedIds.length} 項已選取</span>
          <div className="w-px h-5 bg-white/20"></div>
          <button onClick={handleBatchDelete} className="hover:text-[#ff3b30] transition-colors p-1" title="批次刪除"><Icon name="Trash2" className="w-4 h-4"/></button>
          <button onClick={() => setIsBatchEditOpen(true)} className="hover:text-[#0066cc] transition-colors p-1" title="批次編輯"><Icon name="Edit2" className="w-4 h-4"/></button>
          <button onClick={handleBatchExport} className="hover:text-[#34c759] transition-colors p-1" title="批次匯出"><Icon name="Download" className="w-4 h-4"/></button>
          <button onClick={handleBatchPrint} className="hover:text-white/70 transition-colors p-1" title="批次列印"><Icon name="Printer" className="w-4 h-4"/></button>
          <button onClick={handleBatchShare} className="hover:text-white/70 transition-colors p-1" title="批次分享"><Icon name="Share2" className="w-4 h-4"/></button>
          <div className="w-px h-5 bg-white/20"></div>
          <button onClick={() => setIsCopyToVehicleOpen(true)} className="text-xs font-semibold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors whitespace-nowrap">複製到車型</button>
        </div>
      )}

      <BatchEditModal isOpen={isBatchEditOpen} onClose={() => setIsBatchEditOpen(false)} selectedIds={selectedIds} onApply={handleBatchEditApply} isVehicleMode={false} />
      <CopyToVehicleModal isOpen={isCopyToVehicleOpen} onClose={() => setIsCopyToVehicleOpen(false)} sourceMaterials={processedMaterials.filter(m => selectedIds.includes(m.id))} isConnected={isConnected} currentUser={currentUser} />
      
      <ExcelManagerModal isOpen={isExcelModalOpen} onClose={() => setIsExcelModalOpen(false)} task={task} materials={materials} onImportSuccess={onImportSuccess}/>
      <AuditLogModal isOpen={isAuditLogOpen} onClose={() => setIsAuditLogOpen(false)} logs={auditLogs} />

      <Modal isOpen={isAddMaterialOpen} onClose={() => setIsAddMaterialOpen(false)} title="新增單筆物料" maxWidth="max-w-2xl">
        <form onSubmit={handleAddMaterial} className="space-y-4 sm:space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            <div><label className="block text-xs sm:text-sm font-semibold text-[#1d1d1f] mb-1.5 sm:mb-2">UPG *</label><Input value={formData.part_number} onChange={e => setFormData({...formData, part_number: e.target.value})} placeholder="例如: MOT-A-0012" required/></div>
            <div><label className="block text-xs sm:text-sm font-semibold text-[#1d1d1f] mb-1.5 sm:mb-2">件號</label><Input value={formData.part_code} onChange={e => setFormData({...formData, part_code: e.target.value})} placeholder="例如: PT-001" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            <div><label className="block text-xs sm:text-sm font-semibold text-[#1d1d1f] mb-1.5 sm:mb-2">件名</label><Input value={formData.part_name} onChange={e => setFormData({...formData, part_name: e.target.value})} placeholder="例如: 定子鐵芯總成" /></div>
            <div><label className="block text-xs sm:text-sm font-semibold text-[#1d1d1f] mb-1.5 sm:mb-2">中文件名</label><Input value={formData.part_name_zh} onChange={e => setFormData({...formData, part_name_zh: e.target.value})} placeholder="例如: 定子铁芯总成" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            <div><label className="block text-xs sm:text-sm font-semibold text-[#1d1d1f] mb-1.5 sm:mb-2">單台用量</label><Input type="number" min="1" value={formData.usage_per_unit} onChange={e => setFormData({...formData, usage_per_unit: e.target.value})} placeholder="1" /></div>
            <div><label className="block text-xs sm:text-sm font-semibold text-[#1d1d1f] mb-1.5 sm:mb-2">目標數量 *</label><Input type="number" min="1" value={formData.target_qty} onChange={e => setFormData({...formData, target_qty: e.target.value})} placeholder="0" required/></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            <div><label className="block text-xs sm:text-sm font-semibold text-[#1d1d1f] mb-1.5 sm:mb-2">廠商</label><Input value={formData.supplier} onChange={e => setFormData({...formData, supplier: e.target.value})} placeholder="例如: 供應商A" /></div>
            <div><label className="block text-xs sm:text-sm font-semibold text-[#1d1d1f] mb-1.5 sm:mb-2">零件分類</label><Input value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} placeholder="例如: 機構件" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            <div><label className="block text-xs sm:text-sm font-semibold text-[#1d1d1f] mb-1.5 sm:mb-2">儲位 / 料架位置</label><Input value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="例如: A01-01" /></div>
            <div><label className="block text-xs sm:text-sm font-semibold text-[#1d1d1f] mb-1.5 sm:mb-2">備註</label><Input value={formData.remark} onChange={e => setFormData({...formData, remark: e.target.value})} placeholder="輸入備註..." /></div>
          </div>
          <div><label className="block text-xs sm:text-sm font-semibold text-[#1d1d1f] mb-1.5 sm:mb-2">標籤 (以逗號分隔)</label><Input value={formData.tags} onChange={e => setFormData({...formData, tags: e.target.value})} placeholder="例如: 緊急件, 新件" /></div>
          <div className="pt-4 sm:pt-6 flex justify-end space-x-3"><Button type="button" variant="secondary" onClick={() => setIsAddMaterialOpen(false)}>取消</Button><Button type="submit">確認新增</Button></div>
        </form>
      </Modal>

      <Modal isOpen={isEditMaterialOpen} onClose={() => setIsEditMaterialOpen(false)} title="編輯單筆物料" maxWidth="max-w-2xl">
        {editFormData && (
          <form onSubmit={handleUpdateMaterial} className="space-y-4 sm:space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              <div><label className="block text-xs sm:text-sm font-semibold text-[#1d1d1f] mb-1.5 sm:mb-2">UPG *</label><Input value={editFormData.part_number} onChange={e => setEditFormData({...editFormData, part_number: e.target.value})} required/></div>
              <div><label className="block text-xs sm:text-sm font-semibold text-[#1d1d1f] mb-1.5 sm:mb-2">件號</label><Input value={editFormData.part_code} onChange={e => setEditFormData({...editFormData, part_code: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              <div><label className="block text-xs sm:text-sm font-semibold text-[#1d1d1f] mb-1.5 sm:mb-2">件名</label><Input value={editFormData.part_name} onChange={e => setEditFormData({...editFormData, part_name: e.target.value})} /></div>
              <div><label className="block text-xs sm:text-sm font-semibold text-[#1d1d1f] mb-1.5 sm:mb-2">中文件名</label><Input value={editFormData.part_name_zh} onChange={e => setEditFormData({...editFormData, part_name_zh: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              <div><label className="block text-xs sm:text-sm font-semibold text-[#1d1d1f] mb-1.5 sm:mb-2">單台用量</label><Input type="number" min="1" value={editFormData.usage_per_unit} onChange={e => setEditFormData({...editFormData, usage_per_unit: e.target.value})} /></div>
              <div><label className="block text-xs sm:text-sm font-semibold text-[#1d1d1f] mb-1.5 sm:mb-2">目標數量 *</label><Input type="number" min="1" value={editFormData.target_qty} onChange={e => setEditFormData({...editFormData, target_qty: e.target.value})} required/></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              <div><label className="block text-xs sm:text-sm font-semibold text-[#1d1d1f] mb-1.5 sm:mb-2">廠商</label><Input value={editFormData.supplier} onChange={e => setEditFormData({...editFormData, supplier: e.target.value})} /></div>
              <div><label className="block text-xs sm:text-sm font-semibold text-[#1d1d1f] mb-1.5 sm:mb-2">零件分類</label><Input value={editFormData.category} onChange={e => setEditFormData({...editFormData, category: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              <div><label className="block text-xs sm:text-sm font-semibold text-[#1d1d1f] mb-1.5 sm:mb-2">儲位 / 料架位置</label><Input value={editFormData.location} onChange={e => setEditFormData({...editFormData, location: e.target.value})} /></div>
              <div><label className="block text-xs sm:text-sm font-semibold text-[#1d1d1f] mb-1.5 sm:mb-2">備註</label><Input value={editFormData.remark} onChange={e => setEditFormData({...editFormData, remark: e.target.value})} /></div>
            </div>
            <div><label className="block text-xs sm:text-sm font-semibold text-[#1d1d1f] mb-1.5 sm:mb-2">標籤 (以逗號分隔)</label><Input value={editFormData.tags} onChange={e => setEditFormData({...editFormData, tags: e.target.value})} /></div>
            <div className="pt-4 sm:pt-6 flex justify-end space-x-3"><Button type="button" variant="secondary" onClick={() => setIsEditMaterialOpen(false)}>取消</Button><Button type="submit">儲存變更</Button></div>
          </form>
        )}
      </Modal>

      <Modal isOpen={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="確認刪除">
        <div className="space-y-4 sm:space-y-5">
          <div className="flex items-center justify-center p-4 bg-[#ff3b30]/10 rounded-2xl"><Icon name="AlertTriangle" className="w-8 h-8 text-[#ff3b30] mr-3" /><p className="text-[#1d1d1f] font-medium">確定要刪除此物料嗎？此動作無法復原。</p></div>
          <div className="pt-4 sm:pt-6 flex justify-end space-x-3"><Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>取消</Button><Button variant="danger" onClick={executeDeleteMaterial}>確認刪除</Button></div>
        </div>
      </Modal>

      <Modal isOpen={!!viewRemarkMaterial} onClose={() => setViewRemarkMaterial(null)} title="物料備註">
        {viewRemarkMaterial && (
          <div className="space-y-4 sm:space-y-5">
            <div className="bg-[#f5f5f7] p-4 rounded-2xl border border-[#d2d2d7]/50"><div className="text-xs text-[#86868b] font-bold mb-1">UPG / 件名</div><div className="font-semibold text-[#1d1d1f]">{viewRemarkMaterial.part_number} - {viewRemarkMaterial.part_name}</div></div>
            <div><div className="text-xs text-[#86868b] font-bold mb-2">備註內容</div><div className="bg-white p-4 rounded-2xl border border-[#ff9500]/30 shadow-sm text-[#1d1d1f] whitespace-pre-wrap leading-relaxed">{viewRemarkMaterial.remark}</div></div>
            <div className="pt-4 sm:pt-6 flex justify-end"><Button onClick={() => setViewRemarkMaterial(null)}>關閉</Button></div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const CountMode = ({ material, onSave, onCancel }) => {
  const [qty, setQty] = useState(material.counted_qty);
  const [isPlaying, setIsPlaying] = useState(false);
  const diff = qty - material.target_qty;
  const progress = Math.min(100, Math.max(0, (qty / material.target_qty) * 100)) || 0;
  const isComplete = qty >= material.target_qty;
  const adjustQty = (amount) => setQty(Math.max(0, qty + amount));

  const handlePlayAudio = () => {
    if (isPlaying) return;
    setIsPlaying(true);
    const textToRead = `Item ${material.part_number}. Target quantity: ${material.target_qty}.`;
    playEdgeTTS(textToRead, 'en-US-AriaNeural').finally(() => setIsPlaying(false));
  };

  useEffect(() => { handlePlayAudio(); }, []);

  return (
    <div className="flex flex-col h-full bg-[#f5f5f7] rounded-2xl sm:rounded-[2.5rem] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.1)] absolute inset-0 z-30 m-2 sm:m-4 border border-white/50 animate-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between p-4 sm:p-6 bg-white/60 backdrop-blur-3xl shrink-0 border-b border-[#d2d2d7]/30">
        <div className="flex items-center space-x-3 sm:space-x-5">
          <button onClick={onCancel} className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-full bg-white shadow-sm hover:bg-[#f5f5f7] transition-all active:scale-95 text-[#1d1d1f] shrink-0"><Icon name="ArrowLeft" className="w-5 h-5 sm:w-6 sm:h-6" /></button>
          <div className="truncate flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2 sm:gap-3 truncate mb-1">
                {material.part_code && <span className="bg-[#1d1d1f] text-white px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-bold tracking-wider shadow-sm">{material.part_code}</span>}
                <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-[#1d1d1f] truncate">{material.part_name} {material.part_name_zh && <span className="hidden sm:inline-block ml-1">{material.part_name_zh}</span>}</h2>
              </div>
              <p className="text-[#86868b] text-[10px] sm:text-xs font-medium flex items-center"><span className="mr-1.5 border border-[#d2d2d7] px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold">UPG</span>{material.part_number}</p>
            </div>
            <button onClick={handlePlayAudio} disabled={isPlaying} className={`p-2.5 rounded-full transition-all shrink-0 ${isPlaying ? 'text-[#0066cc] bg-[#0066cc]/10 animate-pulse' : 'text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]'}`} title="播放語音"><Icon name={isPlaying ? "VolumeX" : "Volume2"} className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="flex items-center space-x-3 sm:space-x-4">
          <Badge className={`hidden md:inline-flex px-4 py-1.5 text-sm ${isComplete ? 'bg-[#34c759]/10 text-[#34c759] border-none' : 'bg-[#0066cc]/10 text-[#0066cc] border-none'}`}>{isComplete ? '達標' : '清點中'}</Badge>
          <Button size="lg" onClick={() => onSave(qty)} className="h-10 sm:h-12 px-4 sm:px-6 text-sm sm:text-base shadow-[0_8px_20px_rgba(0,0,0,0.12)] shrink-0"><Icon name="Check" className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2" /> <span className="hidden sm:inline">儲存並返回</span><span className="sm:hidden">儲存</span></Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto flex flex-col lg:flex-row bg-white/40 backdrop-blur-xl">
        <div className="p-6 sm:p-8 lg:p-12 border-b lg:border-b-0 lg:border-r border-[#d2d2d7]/30 flex flex-col space-y-6 sm:space-y-8 lg:w-1/2 justify-center">
          <div className="grid grid-cols-2 gap-4 sm:gap-6 mb-2 sm:mb-6">
            <div className="space-y-2 sm:space-y-3"><label className="text-[10px] sm:text-xs font-bold text-[#86868b] uppercase tracking-widest">廠商 / 分類</label><div className="text-sm sm:text-lg font-semibold text-[#1d1d1f] bg-white/80 backdrop-blur-md p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-[#d2d2d7]/30 shadow-sm truncate">{material.supplier || '-'} / {material.category || '-'}</div></div>
            <div className="space-y-2 sm:space-y-3"><label className="text-[10px] sm:text-xs font-bold text-[#86868b] uppercase tracking-widest">儲位</label><div className="text-sm sm:text-lg font-semibold text-[#1d1d1f] bg-white/80 backdrop-blur-md p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-[#d2d2d7]/30 shadow-sm truncate">{material.location || '-'}</div></div>
          </div>
          <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-8">
            <label className="text-[10px] sm:text-xs font-bold text-[#86868b] uppercase tracking-widest">狀態</label>
            <div className="h-[50px] sm:h-[62px] flex items-center bg-white/80 backdrop-blur-md px-3 sm:px-4 rounded-xl sm:rounded-2xl border border-[#d2d2d7]/30 shadow-sm text-sm sm:text-base">
              {diff < 0 && qty > 0 ? <span className="text-[#ff3b30] flex font-semibold"><Icon name="AlertTriangle" className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2"/> 數量不足</span> : isComplete ? <span className="text-[#34c759] flex font-semibold"><Icon name="CheckCircle2" className="w-4 h-4 sm:w-5 sm:h-5 mr-1.5 sm:mr-2"/> 已完成</span> : <span className="text-[#86868b] font-medium">未完成</span>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-1.5 sm:space-y-2 bg-white/80 backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] border border-[#d2d2d7]/30 text-center shadow-sm"><label className="text-xs sm:text-sm font-semibold text-[#86868b]">目標數量</label><div className="text-3xl sm:text-5xl font-light tracking-tighter text-[#1d1d1f] mt-1 sm:mt-2">{material.target_qty}</div></div>
            <div className="space-y-1.5 sm:space-y-2 bg-white/80 backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] border border-[#0066cc]/20 text-center relative overflow-hidden shadow-[0_8px_30px_rgba(0,102,204,0.08)]">
              <div className="absolute inset-0 bg-[#0066cc]/5 pointer-events-none" style={{height: `${progress}%`, bottom: 0, top: 'auto', transition: 'height 0.5s ease-out'}}></div>
              <label className="text-xs sm:text-sm font-semibold text-[#0066cc] relative z-10">已清點</label><div className="text-3xl sm:text-5xl font-light tracking-tighter text-[#0066cc] relative z-10 mt-1 sm:mt-2">{qty}</div>
            </div>
          </div>
          
          <div className="pt-6 sm:pt-8 flex items-center justify-between border-t border-[#d2d2d7]/30">
             <span className="text-[#86868b] font-semibold text-sm sm:text-lg">差異數量 (Diff)</span>
             <div className={`text-4xl sm:text-6xl font-light tracking-tighter ${diff < 0 ? 'text-[#ff3b30]' : diff > 0 ? 'text-[#ff9500]' : 'text-[#34c759]'}`}>{diff > 0 ? '+' : ''}{diff}</div>
          </div>
        </div>

        <div className="p-6 sm:p-8 lg:p-12 flex flex-col items-center justify-center lg:w-1/2 relative">
          <div className="w-full max-w-md space-y-6 sm:space-y-8 relative z-10">
            <div className="relative group"><input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} className="w-full text-center text-6xl sm:text-[5rem] font-light tracking-tighter bg-white border-none rounded-[2rem] sm:rounded-[2.5rem] py-6 sm:py-8 text-[#1d1d1f] focus:ring-4 focus:ring-[#0066cc]/20 transition-all outline-none shadow-[0_8px_40px_rgba(0,0,0,0.06)]" /></div>
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <button onClick={() => adjustQty(-1)} className="h-16 sm:h-20 text-2xl sm:text-3xl flex items-center justify-center bg-white rounded-2xl sm:rounded-3xl shadow-sm hover:bg-[#f5f5f7] active:scale-95 transition-all text-[#1d1d1f]"><Icon name="Minus" className="w-6 h-6 sm:w-8 sm:h-8" /></button>
              <button onClick={() => adjustQty(1)} className="h-16 sm:h-20 text-2xl sm:text-3xl font-medium flex items-center justify-center bg-white rounded-2xl sm:rounded-3xl shadow-sm hover:bg-[#f5f5f7] active:scale-95 transition-all text-[#0066cc]">+1</button>
              <button onClick={() => adjustQty(5)} className="h-16 sm:h-20 text-2xl sm:text-3xl font-medium flex items-center justify-center bg-white rounded-2xl sm:rounded-3xl shadow-sm hover:bg-[#f5f5f7] active:scale-95 transition-all text-[#0066cc]">+5</button>
              <button onClick={() => setQty(0)} className="h-12 sm:h-16 text-sm sm:text-lg font-semibold flex items-center justify-center bg-white/50 rounded-xl sm:rounded-2xl hover:bg-white active:scale-95 transition-all text-[#86868b]">歸零</button>
              <button onClick={() => adjustQty(10)} className="h-12 sm:h-16 text-lg sm:text-2xl font-medium flex items-center justify-center bg-white rounded-xl sm:rounded-2xl shadow-sm hover:bg-[#f5f5f7] active:scale-95 transition-all text-[#0066cc]">+10</button>
              <button onClick={() => setQty(material.target_qty)} className="h-12 sm:h-16 text-sm sm:text-lg font-semibold flex items-center justify-center bg-[#34c759]/10 rounded-xl sm:rounded-2xl hover:bg-[#34c759]/20 active:scale-95 transition-all text-[#34c759]">補滿</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Vehicle Management (車型管理)
// ============================================================================
const VehicleManager = ({ currentUser, users, isConnected }) => {
  const [vehicles, setVehicles] = useState([]);
  const [sections, setSections] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [isAddSectionOpen, setIsAddSectionOpen] = useState(false);
  const [isAddMaterialOpen, setIsAddMaterialOpen] = useState(false);
  const [isEditMaterialOpen, setIsEditMaterialOpen] = useState(false);
  const [isAuditLogOpen, setIsAuditLogOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isCopyToTaskOpen, setIsCopyToTaskOpen] = useState(false);
  const [isCopyToVehicleOpen, setIsCopyToVehicleOpen] = useState(false);
  const [isBatchEditOpen, setIsBatchEditOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  
  const [formData, setFormData] = useState({});
  const [editFormData, setEditFormData] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [groupBy, setGroupBy] = useState('none');
  const [hoveredMat, setHoveredMat] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

  const canEdit = ['admin', 'leader'].includes(currentUser.role);

  useEffect(() => {
    const vRef = db.ref('vehicles');
    const sRef = db.ref('vehicle_sections');
    const mRef = db.ref('vehicle_materials');
    const lRef = db.ref('vehicle_audit_logs');

    vRef.on('value', snap => { const data = snap.val(); setVehicles(data ? Object.keys(data).map(k => ({...data[k], id: k})) : []); });
    sRef.on('value', snap => { const data = snap.val(); setSections(data ? Object.keys(data).map(k => ({...data[k], id: k})) : []); });
    mRef.on('value', snap => { const data = snap.val(); setMaterials(data ? Object.keys(data).map(k => ({...data[k], id: k})) : []); });
    lRef.on('value', snap => { const data = snap.val(); setAuditLogs(data ? Object.values(data).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) : []); });

    return () => { vRef.off(); sRef.off(); mRef.off(); lRef.off(); };
  }, []);

  const uploadImage = async (file) => {
    const storageRef = firebase.storage().ref();
    const fileRef = storageRef.child(`vehicle_materials/${Date.now()}_${file.name}`);
    await fileRef.put(file);
    return await fileRef.getDownloadURL();
  };

  const handlePasteImage = async (e, isEdit = false) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        setIsUploading(true);
        try {
          const url = await uploadImage(file);
          if (isEdit) setEditFormData(prev => ({...prev, image_url: url}));
          else setFormData(prev => ({...prev, image_url: url}));
          showToast('圖片上傳成功', 'success');
        } catch(err) {
          showToast('圖片上傳失敗', 'error');
        } finally {
          setIsUploading(false);
        }
      }
    }
  };

  const handleAddVehicle = (e) => {
    e.preventDefault();
    if (!isConnected) return showToast('系統未連線', 'error');
    if (!formData.name) return;
    const newRef = db.ref('vehicles').push();
    newRef.set({ id: newRef.key, name: formData.name, description: formData.description || '', created_by: currentUser.id, created_at: new Date().toISOString() }).then(() => { setIsAddVehicleOpen(false); setFormData({}); showToast('車型新增成功', 'success'); });
  };

  const handleAddSection = (e) => {
    e.preventDefault();
    if (!isConnected) return showToast('系統未連線', 'error');
    if (!formData.name) return;
    const newRef = db.ref('vehicle_sections').push();
    newRef.set({ id: newRef.key, vehicle_id: selectedVehicleId, name: formData.name, description: formData.description || '' }).then(() => { setIsAddSectionOpen(false); setFormData({}); showToast('部位新增成功', 'success'); });
  };

  const handleAddMaterial = (e) => {
    e.preventDefault();
    if (!isConnected) return showToast('系統未連線', 'error');
    if (!formData.part_number || !formData.target_qty) return showToast('UPG 與目標數量為必填', 'error');
    
    const newRef = db.ref('vehicle_materials').push();
    const matData = {
      id: newRef.key, section_id: selectedSectionId, part_number: formData.part_number, part_code: formData.part_code || '', part_name: formData.part_name || '', part_name_zh: formData.part_name_zh || '', target_qty: Number(formData.target_qty), usage_per_unit: Number(formData.usage_per_unit) || 1, supplier: formData.supplier || '', category: formData.category || '', location: formData.location || '', remark: formData.remark || '', spec_params: formData.spec_params || '', assembly_group: formData.assembly_group || '', image_url: formData.image_url || '', counted_qty: 0, status: 'pending', unit: 'PCS', tags: formData.tags ? formData.tags.split(',').map(t => ({ name: t.trim(), color: 'bg-[#f5f5f7] text-[#1d1d1f]' })) : []
    };

    newRef.set(matData).then(() => {
      db.ref('vehicle_audit_logs').push({ section_id: selectedSectionId, action: 'CREATE', action_label: '新增物料', entity_name: matData.part_name || matData.part_number, changes: [], user_name: currentUser.name, timestamp: new Date().toISOString() });
      setIsAddMaterialOpen(false); setFormData({}); showToast('物料新增成功', 'success');
    });
  };

  const handleUpdateMaterial = (e) => {
    e.preventDefault();
    if (!isConnected) return showToast('系統未連線', 'error');
    const tags = typeof editFormData.tags === 'string' ? editFormData.tags.split(',').map(t => ({ name: t.trim(), color: 'bg-[#f5f5f7] text-[#1d1d1f]' })) : editFormData.tags;
    db.ref(`vehicle_materials/${editFormData.id}`).update({ ...editFormData, target_qty: Number(editFormData.target_qty), usage_per_unit: Number(editFormData.usage_per_unit), tags }).then(() => {
      db.ref('vehicle_audit_logs').push({ section_id: selectedSectionId, action: 'UPDATE', action_label: '編輯物料', entity_name: editFormData.part_name || editFormData.part_number, changes: [], user_name: currentUser.name, timestamp: new Date().toISOString() });
      setIsEditMaterialOpen(false); showToast('物料更新成功', 'success');
    });
  };

  const executeDeleteMaterial = () => {
    if (!deleteConfirmId) return;
    const mat = materials.find(m => m.id === deleteConfirmId);
    db.ref(`vehicle_materials/${deleteConfirmId}`).remove().then(() => {
      db.ref('vehicle_audit_logs').push({ section_id: selectedSectionId, action: 'DELETE', action_label: '刪除物料', entity_name: mat?.part_name || mat?.part_number, changes: [], user_name: currentUser.name, timestamp: new Date().toISOString() });
      setDeleteConfirmId(null); showToast('物料已刪除', 'success');
    });
  };

  const handleImportSuccess = (newMaterials) => {
    if (!isConnected) return showToast('系統未連線', 'error');
    const updates = {};
    newMaterials.forEach(m => { m.section_id = selectedSectionId; updates[`vehicle_materials/${m.id}`] = m; });
    db.ref().update(updates).then(() => {
      db.ref('vehicle_audit_logs').push({ section_id: selectedSectionId, action: 'CREATE', action_label: '批次匯入', entity_name: `共 ${newMaterials.length} 筆`, changes: [], user_name: currentUser.name, timestamp: new Date().toISOString() });
      showToast(`成功匯入 ${newMaterials.length} 筆`, "success");
    });
  };

  const handleSelectAll = (e, currentList) => {
    if (e.target.checked) setSelectedIds(currentList.map(m => m.id));
    else setSelectedIds([]);
  };

  const handleSelectOne = (id) => {
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(i => i !== id));
    else setSelectedIds([...selectedIds, id]);
  };

  const handleBatchDelete = () => {
    if (!isConnected) return showToast('系統未連線', 'error');
    if (confirm(`確定要刪除選取的 ${selectedIds.length} 筆物料嗎？`)) {
      const updates = {};
      selectedIds.forEach(id => updates[`vehicle_materials/${id}`] = null);
      db.ref().update(updates).then(() => {
        db.ref('vehicle_audit_logs').push({ section_id: selectedSectionId, action: 'DELETE', action_label: '批次刪除', entity_name: `共 ${selectedIds.length} 筆`, changes: [], user_name: currentUser.name, timestamp: new Date().toISOString() });
        showToast('批次刪除成功', 'success'); setSelectedIds([]);
      });
    }
  };

  const handleBatchEditApply = (field, value) => {
    if (!isConnected) return showToast('系統未連線', 'error');
    const updates = {};
    selectedIds.forEach(id => {
      let finalValue = value;
      if (field === 'target_qty' || field === 'usage_per_unit') finalValue = Number(value) || 0;
      if (field === 'tags') finalValue = value ? value.split(',').map(t => ({ name: t.trim(), color: 'bg-[#f5f5f7] text-[#1d1d1f]' })) : [];
      updates[`vehicle_materials/${id}/${field}`] = finalValue;
    });
    db.ref().update(updates).then(() => {
      db.ref('vehicle_audit_logs').push({ section_id: selectedSectionId, action: 'UPDATE', action_label: '批次編輯', entity_name: `共 ${selectedIds.length} 筆`, changes: [{field, old: '多筆資料', new: value}], user_name: currentUser.name, timestamp: new Date().toISOString() });
      showToast('批次編輯成功', 'success'); setSelectedIds([]);
    });
  };

  const handleBatchExport = () => {
    const XLSX = window.XLSX;
    if (!XLSX) return showToast("Excel 模組尚未載入", "error");
    const exportData = materials.filter(m => selectedIds.includes(m.id)).map(m => ({
      "UPG": m.part_number, "件號": m.part_code || '', "件名": m.part_name, "中文件名": m.part_name_zh || '', "單位": m.unit, "單台用量": m.usage_per_unit || 1, "目標數量": m.target_qty, "已清點數量": m.counted_qty, "差異數量": m.counted_qty - m.target_qty, "狀態": m.counted_qty >= m.target_qty ? '已完成' : (m.counted_qty > 0 ? '清點中' : '未清點'), "廠商": m.supplier || '', "零件分類": m.category || '', "儲位": m.location || '', "標籤": (m.tags || []).map(t => t.name).join(','), "備註": m.remark || '', "規格參數": m.spec_params || '', "組裝作業": m.assembly_group || ''
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "批次匯出");
    XLSX.writeFile(wb, `[批次匯出]_結果.xlsx`);
    showToast("匯出成功", "success");
  };

  const handleBatchPrint = () => {
    const printWindow = window.open('', '_blank');
    const mats = materials.filter(m => selectedIds.includes(m.id));
    printWindow.document.write('<html><head><title>列印物料清單</title><style>body{font-family:sans-serif;} table {width: 100%; border-collapse: collapse; margin-top:20px;} th, td {border: 1px solid #ddd; padding: 8px; text-align: left;} th{background-color:#f5f5f7;}</style></head><body><h2>物料清單</h2><table><thead><tr><th>UPG</th><th>件名</th><th>儲位</th><th>目標數量</th></tr></thead><tbody>');
    mats.forEach(m => printWindow.document.write(`<tr><td>${m.part_number}</td><td>${m.part_name}</td><td>${m.location||'-'}</td><td>${m.target_qty}</td></tr>`));
    printWindow.document.write('</tbody></table></body></html>');
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const handleBatchShare = () => {
    const mats = materials.filter(m => selectedIds.includes(m.id));
    const text = mats.map(m => `[${m.location||'無儲位'}] ${m.part_number} - ${m.part_name} (需 ${m.target_qty})`).join('\n');
    navigator.clipboard.writeText(text).then(() => showToast('已複製清單至剪貼簿', 'success'));
  };

  // Render Level 1: Vehicles
  if (!selectedVehicleId) {
    return (
      <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500 pb-12">
        <div className="flex justify-between items-center">
          <div><h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1d1d1f]">車型管理</h1><p className="text-[#86868b] text-xs sm:text-sm mt-1.5 font-medium">管理各車型專屬的 BOM 表與物料清單</p></div>
          {canEdit && <Button onClick={() => setIsAddVehicleOpen(true)}><Icon name="Plus" className="w-4 h-4 mr-2" /> 新增車型</Button>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {vehicles.map(v => (
            <Card key={v.id} className="hover:shadow-lg cursor-pointer group transition-all" onClick={() => setSelectedVehicleId(v.id)}>
              <div className="p-6">
                <div className="w-12 h-12 bg-[#0066cc]/10 rounded-xl flex items-center justify-center mb-4 text-[#0066cc]"><Icon name="Car" className="w-6 h-6" /></div>
                <h3 className="text-xl font-semibold text-[#1d1d1f] mb-2">{v.name}</h3>
                <p className="text-[#86868b] text-sm line-clamp-2">{v.description || '無描述'}</p>
                <div className="mt-6 pt-4 border-t border-[#d2d2d7]/30 flex justify-between items-center text-xs text-[#86868b] font-medium">
                  <span>{sections.filter(s => s.vehicle_id === v.id).length} 個部位</span><span className="flex items-center group-hover:text-[#0066cc] transition-colors">進入 <Icon name="ArrowRight" className="w-3.5 h-3.5 ml-1" /></span>
                </div>
              </div>
            </Card>
          ))}
        </div>
        <Modal isOpen={isAddVehicleOpen} onClose={() => setIsAddVehicleOpen(false)} title="新增車型">
          <form onSubmit={handleAddVehicle} className="space-y-4">
            <div><label className="block text-sm font-semibold mb-2">車型名稱</label><Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required/></div>
            <div><label className="block text-sm font-semibold mb-2">描述</label><Input value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
            <div className="flex justify-end space-x-3 pt-4"><Button variant="secondary" type="button" onClick={() => setIsAddVehicleOpen(false)}>取消</Button><Button type="submit">確認</Button></div>
          </form>
        </Modal>
      </div>
    );
  }

  const currentVehicle = vehicles.find(v => v.id === selectedVehicleId);

  // Render Level 2: Sections
  if (!selectedSectionId) {
    const vSections = sections.filter(s => s.vehicle_id === selectedVehicleId);
    return (
      <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500 pb-12">
        <div className="flex items-center space-x-4">
          <button onClick={() => setSelectedVehicleId(null)} className="w-10 h-10 rounded-full bg-white border border-[#d2d2d7]/50 flex items-center justify-center hover:bg-[#f5f5f7]"><Icon name="ArrowLeft" className="w-5 h-5"/></button>
          <div><h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1d1d1f]">{currentVehicle?.name} - 部位管理</h1></div>
          {canEdit && <Button className="ml-auto" onClick={() => setIsAddSectionOpen(true)}><Icon name="Plus" className="w-4 h-4 mr-2" /> 新增部位</Button>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {vSections.map(s => (
            <Card key={s.id} className="hover:shadow-lg cursor-pointer group transition-all" onClick={() => setSelectedSectionId(s.id)}>
              <div className="p-6">
                <div className="w-12 h-12 bg-[#af52de]/10 rounded-xl flex items-center justify-center mb-4 text-[#af52de]"><Icon name="Layers" className="w-6 h-6" /></div>
                <h3 className="text-xl font-semibold text-[#1d1d1f] mb-2">{s.name}</h3>
                <p className="text-[#86868b] text-sm line-clamp-2">{s.description || '無描述'}</p>
                <div className="mt-6 pt-4 border-t border-[#d2d2d7]/30 flex justify-between items-center text-xs text-[#86868b] font-medium">
                  <span>{materials.filter(m => m.section_id === s.id).length} 項物料</span><span className="flex items-center group-hover:text-[#af52de] transition-colors">進入清單 <Icon name="ArrowRight" className="w-3.5 h-3.5 ml-1" /></span>
                </div>
              </div>
            </Card>
          ))}
        </div>
        <Modal isOpen={isAddSectionOpen} onClose={() => setIsAddSectionOpen(false)} title="新增部位">
          <form onSubmit={handleAddSection} className="space-y-4">
            <div><label className="block text-sm font-semibold mb-2">部位名稱 (如: 引擎)</label><Input value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} required/></div>
            <div><label className="block text-sm font-semibold mb-2">描述</label><Input value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
            <div className="flex justify-end space-x-3 pt-4"><Button variant="secondary" type="button" onClick={() => setIsAddSectionOpen(false)}>取消</Button><Button type="submit">確認</Button></div>
          </form>
        </Modal>
      </div>
    );
  }

  // Render Level 3: Materials
  const currentSection = sections.find(s => s.id === selectedSectionId);
  const sectionMaterials = materials.filter(m => m.section_id === selectedSectionId);
  
  let filteredMats = sectionMaterials.filter(m => 
    (m.part_number||'').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (m.part_name||'').toLowerCase().includes(searchTerm.toLowerCase())
  );

  let groupedMats = { '全部': filteredMats };
  if (groupBy !== 'none') {
    groupedMats = filteredMats.reduce((acc, mat) => {
      const key = mat[groupBy] || '未分類';
      if (!acc[key]) acc[key] = [];
      acc[key].push(mat);
      return acc;
    }, {});
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-[1600px] mx-auto flex flex-col h-[calc(100vh-3rem)] animate-in fade-in duration-300 relative">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <button onClick={() => {setSelectedSectionId(null); setSelectedIds([]);}} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white border border-[#d2d2d7]/50 flex items-center justify-center hover:bg-[#f5f5f7]"><Icon name="ArrowLeft" className="w-4 h-4 sm:w-5 sm:h-5"/></button>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#1d1d1f]">{currentVehicle?.name} / {currentSection?.name}</h1>
            <div className="text-xs text-[#86868b] mt-1 font-medium">共 {sectionMaterials.length} 項物料</div>
          </div>
        </div>
        <div className="flex space-x-2 sm:space-x-3 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <Button variant="outline" onClick={() => setIsAuditLogOpen(true)} className="bg-white"><Icon name="History" className="w-4 h-4 mr-2" /> 操作紀錄</Button>
          {canEdit && (
            <>
              <Button variant="secondary" onClick={() => setIsExcelModalOpen(true)}><Icon name="FileSpreadsheet" className="w-4 h-4 mr-2 text-[#34c759]" /> Excel 作業</Button>
              <Button onClick={() => {setFormData({}); setIsAddMaterialOpen(true);}}><Icon name="Plus" className="w-4 h-4 mr-2" /> 新增物料</Button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 shrink-0">
        <div className="relative flex-1 max-w-md">
          <Icon name="Search" className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868b]" />
          <Input placeholder="搜尋 UPG、件名..." className="pl-11 bg-white border-none shadow-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
        </div>
        <select className="h-11 rounded-xl border border-[#d2d2d7] bg-white px-4 text-sm shadow-sm outline-none focus:ring-2 focus:ring-[#0066cc]/50" value={groupBy} onChange={e => setGroupBy(e.target.value)}>
          <option value="none">不分組</option><option value="supplier">依廠商分組</option><option value="location">依儲位分組</option><option value="assembly_group">依組裝作業分組</option>
        </select>
      </div>

      <div className="flex-1 overflow-auto space-y-6 pb-24">
        {Object.keys(groupedMats).map(groupKey => (
          <div key={groupKey}>
            {groupBy !== 'none' && <h3 className="text-sm font-bold text-[#86868b] uppercase tracking-wider mb-3 pl-2">{groupKey} ({groupedMats[groupKey].length})</h3>}
            <Card className="overflow-hidden p-0 border-none shadow-sm bg-white">
              <table className="w-full text-sm text-left whitespace-nowrap block lg:table">
                <thead className="bg-[#f5f5f7]/80 text-[#86868b] border-b border-[#d2d2d7]/30 hidden lg:table-header-group">
                  <tr>
                    <th className="px-4 py-4 w-10 text-center"><input type="checkbox" className="rounded border-[#d2d2d7] text-[#0066cc] focus:ring-[#0066cc]" checked={selectedIds.length === groupedMats[groupKey].length && groupedMats[groupKey].length > 0} onChange={(e) => handleSelectAll(e, groupedMats[groupKey])} /></th>
                    <th className="px-4 py-4 font-semibold w-12">圖</th>
                    <th className="px-4 py-4 font-semibold min-w-[200px]">UPG / 件名</th>
                    <th className="px-4 py-4 font-semibold w-24">分類</th>
                    <th className="px-4 py-4 font-semibold w-24">廠商</th>
                    <th className="px-4 py-4 font-semibold w-24">儲位</th>
                    <th className="px-4 py-4 font-semibold w-32">組裝作業</th>
                    <th className="px-4 py-4 font-semibold text-center w-20">用量</th>
                    <th className="px-4 py-4 font-semibold text-right w-24">操作</th>
                  </tr>
                </thead>
                <tbody className="block lg:table-row-group divide-y divide-[#d2d2d7]/30">
                  {groupedMats[groupKey].map(mat => {
                    const isSelected = selectedIds.includes(mat.id);
                    return (
                      <tr key={mat.id} className={`block lg:table-row transition-colors group relative ${isSelected ? 'bg-[#0066cc]/5' : 'hover:bg-[#f5f5f7]/50'}`}
                          onMouseMove={(e) => setHoverPos({x: e.clientX, y: e.clientY})}
                          onMouseEnter={() => setHoveredMat(mat)}
                          onMouseLeave={() => setHoveredMat(null)}>
                        <td className="px-4 py-3 hidden lg:table-cell text-center"><input type="checkbox" className="rounded border-[#d2d2d7] text-[#0066cc] focus:ring-[#0066cc]" checked={isSelected} onChange={() => handleSelectOne(mat.id)} /></td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {mat.image_url ? <img src={mat.image_url} className="w-8 h-8 rounded object-cover border border-[#d2d2d7]" /> : <div className="w-8 h-8 rounded bg-[#f5f5f7] flex items-center justify-center text-[#86868b]"><Icon name="Image" className="w-4 h-4"/></div>}
                        </td>
                        <td className="px-4 py-3 block lg:table-cell">
                          <div className="lg:hidden mb-2"><input type="checkbox" className="rounded border-[#d2d2d7] text-[#0066cc] focus:ring-[#0066cc]" checked={isSelected} onChange={() => handleSelectOne(mat.id)} /></div>
                          <div className="font-bold text-[#1d1d1f] text-base">{mat.part_name}</div>
                          <div className="text-xs text-[#86868b] font-mono mt-0.5">{mat.part_number}</div>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-[#86868b]">{mat.category || '-'}</td>
                        <td className="px-4 py-3 hidden lg:table-cell text-[#86868b]">{mat.supplier || '-'}</td>
                        <td className="px-4 py-3 hidden lg:table-cell font-semibold">{mat.location || '-'}</td>
                        <td className="px-4 py-3 hidden lg:table-cell text-[#0066cc] font-medium">{mat.assembly_group || '-'}</td>
                        <td className="px-4 py-3 hidden lg:table-cell text-center font-bold">{mat.usage_per_unit || 1}</td>
                        <td className="px-4 py-3 flex lg:table-cell justify-end items-center space-x-2">
                          {canEdit && (
                            <>
                              <button onClick={() => {setEditFormData({...mat, tags: (mat.tags||[]).map(t=>t.name).join(',')}); setIsEditMaterialOpen(true);}} className="p-2 text-[#86868b] hover:text-[#0066cc] hover:bg-[#0066cc]/10 rounded-full"><Icon name="Edit2" className="w-4 h-4"/></button>
                              <button onClick={() => setDeleteConfirmId(mat.id)} className="p-2 text-[#86868b] hover:text-[#ff3b30] hover:bg-[#ff3b30]/10 rounded-full"><Icon name="Trash2" className="w-4 h-4"/></button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          </div>
        ))}
      </div>

      {/* Batch Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#1d1d1f]/90 backdrop-blur-xl text-white px-6 py-3.5 rounded-full shadow-2xl flex items-center gap-4 z-50 animate-in slide-in-from-bottom-10 border border-white/10">
          <span className="font-bold text-sm whitespace-nowrap">{selectedIds.length} 項已選取</span>
          <div className="w-px h-5 bg-white/20"></div>
          <button onClick={handleBatchDelete} className="hover:text-[#ff3b30] transition-colors p-1" title="批次刪除"><Icon name="Trash2" className="w-4 h-4"/></button>
          <button onClick={() => setIsBatchEditOpen(true)} className="hover:text-[#0066cc] transition-colors p-1" title="批次編輯"><Icon name="Edit2" className="w-4 h-4"/></button>
          <button onClick={handleBatchExport} className="hover:text-[#34c759] transition-colors p-1" title="批次匯出"><Icon name="Download" className="w-4 h-4"/></button>
          <button onClick={handleBatchPrint} className="hover:text-white/70 transition-colors p-1" title="批次列印"><Icon name="Printer" className="w-4 h-4"/></button>
          <button onClick={handleBatchShare} className="hover:text-white/70 transition-colors p-1" title="批次分享"><Icon name="Share2" className="w-4 h-4"/></button>
          <div className="w-px h-5 bg-white/20"></div>
          <button onClick={() => setIsCopyToTaskOpen(true)} className="text-xs font-semibold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors whitespace-nowrap">複製到任務</button>
          <button onClick={() => setIsCopyToVehicleOpen(true)} className="text-xs font-semibold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors whitespace-nowrap">複製到車型</button>
        </div>
      )}

      {/* Hover Preview Card */}
      {hoveredMat && (
        <div className="fixed z-[100] pointer-events-none transition-opacity duration-200" style={{ left: hoverPos.x + 20, top: hoverPos.y + 20 }}>
          <div className="bg-white/95 backdrop-blur-xl border border-[#d2d2d7]/50 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.15)] p-4 w-72 flex flex-col gap-3">
            {hoveredMat.image_url ? (
              <img src={hoveredMat.image_url} className="w-full h-40 object-cover rounded-xl border border-[#d2d2d7]/30" />
            ) : (
              <div className="w-full h-32 bg-[#f5f5f7] rounded-xl flex flex-col items-center justify-center text-[#86868b]">
                <Icon name="ImageOff" className="w-8 h-8 mb-2 opacity-50"/>
                <span className="text-xs font-medium">無圖片</span>
              </div>
            )}
            <div>
              <div className="font-bold text-[#1d1d1f] text-base leading-tight">{hoveredMat.part_name}</div>
              <div className="text-xs text-[#86868b] font-mono mt-0.5">{hoveredMat.part_number}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-[#f5f5f7] p-2 rounded-lg"><span className="text-[#86868b] block mb-0.5">組裝作業</span><span className="font-semibold text-[#0066cc]">{hoveredMat.assembly_group || '-'}</span></div>
              <div className="bg-[#f5f5f7] p-2 rounded-lg"><span className="text-[#86868b] block mb-0.5">儲位</span><span className="font-semibold text-[#1d1d1f]">{hoveredMat.location || '-'}</span></div>
            </div>
            {hoveredMat.spec_params && (
              <div className="bg-[#ff9500]/10 p-2.5 rounded-lg border border-[#ff9500]/20">
                <div className="text-[10px] font-bold text-[#ff9500] uppercase tracking-wider mb-1 flex items-center"><Icon name="AlertCircle" className="w-3 h-3 mr-1"/> 規格參數</div>
                <div className="text-xs font-medium text-[#1d1d1f] whitespace-pre-wrap">{hoveredMat.spec_params}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <BatchEditModal isOpen={isBatchEditOpen} onClose={() => setIsBatchEditOpen(false)} selectedIds={selectedIds} onApply={handleBatchEditApply} isVehicleMode={true} />
      <CopyToTaskModal isOpen={isCopyToTaskOpen} onClose={() => setIsCopyToTaskOpen(false)} sourceMaterials={materials.filter(m => selectedIds.includes(m.id))} isConnected={isConnected} currentUser={currentUser} />
      <CopyToVehicleModal isOpen={isCopyToVehicleOpen} onClose={() => setIsCopyToVehicleOpen(false)} sourceMaterials={materials.filter(m => selectedIds.includes(m.id))} isConnected={isConnected} currentUser={currentUser} />

      <Modal isOpen={isAddMaterialOpen || isEditMaterialOpen} onClose={() => {setIsAddMaterialOpen(false); setIsEditMaterialOpen(false);}} title={isAddMaterialOpen ? "新增車型物料" : "編輯車型物料"} maxWidth="max-w-2xl">
        <form onSubmit={isAddMaterialOpen ? handleAddMaterial : handleUpdateMaterial} className="space-y-5" onPaste={(e) => handlePasteImage(e, isEditMaterialOpen)}>
          <div className="bg-[#f5f5f7] p-4 rounded-xl border border-dashed border-[#d2d2d7] text-center relative overflow-hidden group">
            {(isAddMaterialOpen ? formData.image_url : editFormData?.image_url) ? (
              <img src={isAddMaterialOpen ? formData.image_url : editFormData?.image_url} className="h-32 mx-auto object-contain rounded" />
            ) : (
              <div className="py-4 text-[#86868b]">
                <Icon name="ImagePlus" className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">點擊上傳圖片，或直接 <kbd className="bg-white px-1.5 py-0.5 rounded border shadow-sm mx-1">Ctrl+V</kbd> 貼上截圖</p>
              </div>
            )}
            <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => {if(e.target.files[0]) handlePasteImage({clipboardData: {items: [{type: 'image', getAsFile: () => e.target.files[0]}]}}, isEditMaterialOpen)}} />
            {isUploading && <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center"><Icon name="Loader2" className="w-6 h-6 animate-spin text-[#0066cc]"/></div>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold mb-1.5">UPG *</label><Input value={(isAddMaterialOpen ? formData : editFormData)?.part_number || ''} onChange={e => isAddMaterialOpen ? setFormData({...formData, part_number: e.target.value}) : setEditFormData({...editFormData, part_number: e.target.value})} required/></div>
            <div><label className="block text-xs font-semibold mb-1.5">件號</label><Input value={(isAddMaterialOpen ? formData : editFormData)?.part_code || ''} onChange={e => isAddMaterialOpen ? setFormData({...formData, part_code: e.target.value}) : setEditFormData({...editFormData, part_code: e.target.value})} /></div>
            <div><label className="block text-xs font-semibold mb-1.5">件名</label><Input value={(isAddMaterialOpen ? formData : editFormData)?.part_name || ''} onChange={e => isAddMaterialOpen ? setFormData({...formData, part_name: e.target.value}) : setEditFormData({...editFormData, part_name: e.target.value})} /></div>
            <div><label className="block text-xs font-semibold mb-1.5">組裝作業 (如: 觸媒組立)</label><Input value={(isAddMaterialOpen ? formData : editFormData)?.assembly_group || ''} onChange={e => isAddMaterialOpen ? setFormData({...formData, assembly_group: e.target.value}) : setEditFormData({...editFormData, assembly_group: e.target.value})} /></div>
            <div className="sm:col-span-2"><label className="block text-xs font-semibold mb-1.5 text-[#ff9500]">規格參數 (如: 扭力 5Nm)</label><Input value={(isAddMaterialOpen ? formData : editFormData)?.spec_params || ''} onChange={e => isAddMaterialOpen ? setFormData({...formData, spec_params: e.target.value}) : setEditFormData({...editFormData, spec_params: e.target.value})} className="border-[#ff9500]/30 focus-visible:ring-[#ff9500]/10 focus-visible:border-[#ff9500]"/></div>
            <div><label className="block text-xs font-semibold mb-1.5">單台用量</label><Input type="number" min="1" value={(isAddMaterialOpen ? formData : editFormData)?.usage_per_unit || ''} onChange={e => isAddMaterialOpen ? setFormData({...formData, usage_per_unit: e.target.value}) : setEditFormData({...editFormData, usage_per_unit: e.target.value})} /></div>
            <div><label className="block text-xs font-semibold mb-1.5">目標數量 *</label><Input type="number" min="1" value={(isAddMaterialOpen ? formData : editFormData)?.target_qty || ''} onChange={e => isAddMaterialOpen ? setFormData({...formData, target_qty: e.target.value}) : setEditFormData({...editFormData, target_qty: e.target.value})} required/></div>
            <div><label className="block text-xs font-semibold mb-1.5">廠商</label><Input value={(isAddMaterialOpen ? formData : editFormData)?.supplier || ''} onChange={e => isAddMaterialOpen ? setFormData({...formData, supplier: e.target.value}) : setEditFormData({...editFormData, supplier: e.target.value})} /></div>
            <div><label className="block text-xs font-semibold mb-1.5">儲位</label><Input value={(isAddMaterialOpen ? formData : editFormData)?.location || ''} onChange={e => isAddMaterialOpen ? setFormData({...formData, location: e.target.value}) : setEditFormData({...editFormData, location: e.target.value})} /></div>
          </div>
          <div className="flex justify-end space-x-3 pt-4"><Button variant="secondary" type="button" onClick={() => {setIsAddMaterialOpen(false); setIsEditMaterialOpen(false);}}>取消</Button><Button type="submit" disabled={isUploading}>儲存</Button></div>
        </form>
      </Modal>

      <Modal isOpen={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="確認刪除">
        <div className="space-y-4 sm:space-y-5">
          <div className="flex items-center justify-center p-4 bg-[#ff3b30]/10 rounded-2xl"><Icon name="AlertTriangle" className="w-8 h-8 text-[#ff3b30] mr-3" /><p className="text-[#1d1d1f] font-medium">確定要刪除此物料嗎？此動作無法復原。</p></div>
          <div className="pt-4 sm:pt-6 flex justify-end space-x-3"><Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>取消</Button><Button variant="danger" onClick={executeDeleteMaterial}>確認刪除</Button></div>
        </div>
      </Modal>

      <ExcelManagerModal isOpen={isExcelModalOpen} onClose={() => setIsExcelModalOpen(false)} task={{title: `${currentVehicle?.name} - ${currentSection?.name}`}} materials={sectionMaterials} onImportSuccess={handleImportSuccess} isVehicleMode={true}/>
      <AuditLogModal isOpen={isAuditLogOpen} onClose={() => setIsAuditLogOpen(false)} logs={auditLogs.filter(l => l.section_id === selectedSectionId)} />
    </div>
  );
};

// ============================================================================
// Main Application App
// ============================================================================
function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginMode, setLoginMode] = useState('normal');
  const [currentUser, setCurrentUser] = useState(MOCK_USERS[0]);
  const [activeTab, setActiveTab] = useState(currentUser.role === 'operator' ? 'tasks' : 'dashboard');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [countingMaterialId, setCountingMaterialId] = useState(null);
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [adminPassword, setAdminPassword] = useState('admin');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const usersRef = db.ref('users');
    const tasksRef = db.ref('tasks');
    const materialsRef = db.ref('materials');
    const pwdRef = db.ref('adminPassword');
    const logsRef = db.ref('audit_logs');
    const connectedRef = db.ref('.info/connected');

    connectedRef.on('value', (snap) => setIsConnected(snap.val() === true));
    pwdRef.on('value', (snapshot) => { const val = snapshot.val(); if (val) setAdminPassword(val); else { pwdRef.set('admin'); setAdminPassword('admin'); } });
    usersRef.on('value', (snapshot) => { const data = snapshot.val(); if (data) setUsers(Object.keys(data).map(key => ({ ...data[key], id: key }))); else { const initialUsers = MOCK_USERS.reduce((acc, u) => ({...acc, [u.id]: u}), {}); usersRef.set(initialUsers); } });

    usersRef.once('value').then(userSnap => {
      const usersData = userSnap.val();
      const usersList = usersData ? Object.keys(usersData).map(key => ({ ...usersData[key], id: key })) : MOCK_USERS;
      const firstAdmin = usersList.find(u => u.role === 'admin') || MOCK_USERS[0];
      
      tasksRef.on('value', (taskSnap) => {
        const taskData = taskSnap.val();
        if (taskData) {
          const updates = {};
          let hasUpdates = false;
          const tasksArray = Object.keys(taskData).map(taskId => {
            const t = { ...taskData[taskId], id: taskId };
            const currentOwner = usersList.find(u => u.id === t.owner_id);
            if (!t.owner_id || !currentOwner || currentOwner.role !== 'admin') {
              updates[`${taskId}/owner_id`] = firstAdmin.id;
              const currentAllowed = t.allowed_users || [];
              if (!currentAllowed.includes(firstAdmin.id)) updates[`${taskId}/allowed_users`] = [...currentAllowed, firstAdmin.id];
              hasUpdates = true; t.owner_id = firstAdmin.id; t.allowed_users = [...currentAllowed, firstAdmin.id];
            }
            return t;
          });
          if (hasUpdates) tasksRef.update(updates);
          setTasks(tasksArray);
        } else {
          const initialTasks = MOCK_TASKS.reduce((acc, t) => ({...acc, [t.id]: t}), {});
          tasksRef.set(initialTasks);
        }
      });
    });

    materialsRef.on('value', (snapshot) => { const data = snapshot.val(); if (data) setMaterials(Object.keys(data).map(key => ({ ...data[key], id: key }))); else { const initialMaterials = MOCK_MATERIALS.reduce((acc, m) => ({...acc, [m.id]: m}), {}); materialsRef.set(initialMaterials); } setIsLoading(false); });
    logsRef.on('value', (snapshot) => { const data = snapshot.val(); if (data) setAuditLogs(Object.values(data).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))); else setAuditLogs([]); });

    return () => { usersRef.off(); tasksRef.off(); materialsRef.off(); pwdRef.off(); logsRef.off(); connectedRef.off(); };
  }, []);

  const tasksWithProgress = useMemo(() => {
    return tasks.map(task => {
      const tMats = materials.filter(m => m.task_id === task.id);
      const materialCount = tMats.length;
      if (materialCount === 0) return { ...task, progress: 0, materialCount: 0 };
      const progress = Math.round((tMats.filter(m => m.counted_qty >= m.target_qty).length / materialCount) * 100);
      return { ...task, progress, materialCount };
    });
  }, [tasks, materials]);

  const accessibleTasks = useMemo(() => {
    return tasksWithProgress.filter(t => t.owner_id === currentUser.id || (t.allowed_users && t.allowed_users.includes(currentUser.id)));
  }, [tasksWithProgress, currentUser]);

  const activeTask = useMemo(() => accessibleTasks.find(t => t.id === selectedTaskId), [accessibleTasks, selectedTaskId]);
  const taskMaterials = useMemo(() => materials.filter(m => m.task_id === selectedTaskId), [materials, selectedTaskId]);
  const countingMaterial = useMemo(() => materials.find(m => m.id === countingMaterialId), [materials, countingMaterialId]);

  const handleSaveCount = (newQty) => {
    if (!isConnected) return showToast('系統未連線，無法儲存變更，請檢查網路狀態', 'error');
    if (!countingMaterialId) return;
    const mat = materials.find(m => m.id === countingMaterialId);
    if (mat.counted_qty !== newQty) {
      db.ref(`materials/${countingMaterialId}`).update({ counted_qty: newQty }).then(() => {
        db.ref('audit_logs').push({ task_id: mat.task_id, action: 'UPDATE', action_label: '更新清點數量', entity_name: mat.part_name || mat.part_number, changes: [{ field: '已清點數量', old: mat.counted_qty, new: newQty }], user_name: currentUser.name, timestamp: new Date().toISOString() });
        setCountingMaterialId(null); showToast("清點數量已同步", "success");
      }).catch((error) => { showToast("更新失敗，請檢查網路連線", "error"); console.error(error); });
    } else setCountingMaterialId(null);
  };

  const handleImportSuccess = (newMaterials) => {
    if (!isConnected) return showToast('系統未連線，無法匯入', 'error');
    const updates = {};
    newMaterials.forEach(m => updates[`materials/${m.id}`] = m);
    db.ref().update(updates).then(() => {
      if(newMaterials.length > 0) {
          db.ref('audit_logs').push({ task_id: newMaterials[0].task_id, action: 'CREATE', action_label: '批次匯入物料', entity_name: `共 ${newMaterials.length} 筆`, changes: [], user_name: currentUser.name, timestamp: new Date().toISOString() });
      }
      showToast(`成功匯入 ${newMaterials.length} 筆資料`, "success");
    }).catch((error) => { showToast("匯入失敗", "error"); console.error(error); });
  };

  const handleLoginSuccess = (mode, user) => {
    setIsLoggedIn(true); setLoginMode(mode);
    if (mode === 'admin') {
      const adminUser = users.find(u => u.role === 'admin') || MOCK_USERS[0];
      setCurrentUser(adminUser); setActiveTab('settings');
    } else {
      setCurrentUser(user); setActiveTab(user.role === 'operator' ? 'tasks' : 'dashboard');
    }
  };

  const handleTabChange = (tab) => {
    if (tab === 'settings' && loginMode === 'normal') setIsAuthModalOpen(true);
    else { setActiveTab(tab); setSelectedTaskId(null); setCountingMaterialId(null); }
  };

  const handleAuthSubmit = (e) => {
    e.preventDefault();
    if (authPassword === adminPassword) {
      setIsAuthModalOpen(false); setAuthPassword(''); setActiveTab('settings'); setSelectedTaskId(null); setCountingMaterialId(null); showToast('驗證成功', 'success');
    } else showToast('密碼錯誤', 'error');
  };

  return (
    <>
      <ToastContainer />
      {isLoading ? (
        <div className="flex h-screen items-center justify-center bg-[#f5f5f7] text-[#86868b]"><Icon name="Loader2" className="w-8 h-8 animate-spin mr-3 text-[#1d1d1f]" /><span className="font-medium text-lg tracking-tight">載入中...</span></div>
      ) : !isLoggedIn ? (
        <LoginScreen onLogin={handleLoginSuccess} adminPassword={adminPassword} users={users} />
      ) : (
        <div className="flex h-screen bg-[#f5f5f7] text-[#1d1d1f] font-sans selection:bg-blue-200/50 overflow-hidden relative">
          {isSidebarOpen && <div className="fixed inset-0 bg-[#1d1d1f]/20 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300" onClick={() => setIsSidebarOpen(false)}></div>}
          <Sidebar activeTab={activeTab} onTabChange={handleTabChange} currentUser={currentUser} users={users} onLogout={() => setIsLoggedIn(false)} loginMode={loginMode} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isDesktopOpen={isDesktopSidebarOpen} />
          <main className="flex-1 flex flex-col overflow-hidden relative w-full">
            <header className="h-16 sm:h-20 border-b border-[#d2d2d7]/50 flex items-center justify-between px-4 sm:px-8 shrink-0 bg-white/60 backdrop-blur-3xl z-10">
               <div className="flex items-center">
                 <button onClick={() => setIsSidebarOpen(true)} className="md:hidden mr-3 text-[#1d1d1f] p-2 -ml-2 rounded-full hover:bg-[#f5f5f7] transition-colors"><Icon name="Menu" className="w-5 h-5" /></button>
                 <button onClick={() => setIsDesktopSidebarOpen(!isDesktopSidebarOpen)} className="hidden md:block mr-3 text-[#1d1d1f] p-2 -ml-2 rounded-full hover:bg-[#f5f5f7] transition-colors"><Icon name="Menu" className="w-5 h-5" /></button>
                 <div className="text-[#86868b] font-semibold text-xs sm:text-sm tracking-wide truncate max-w-[150px] sm:max-w-none">
                   {activeTab === 'dashboard' ? '營運總覽' : activeTab === 'tasks' ? (selectedTaskId ? `任務 / ${activeTask?.title}` : '任務清單') : activeTab === 'vehicles' ? '車型管理' : '後台管理系統'}
                 </div>
               </div>
               <div className="flex items-center space-x-3 sm:space-x-5">
                 <div className={`hidden sm:flex items-center text-xs font-bold px-3 py-1.5 rounded-full ${isConnected ? 'text-[#34c759] bg-[#34c759]/10' : 'text-[#ff3b30] bg-[#ff3b30]/10'}`}>
                   <span className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-[#34c759] animate-pulse shadow-[0_0_8px_rgba(52,199,89,0.5)]' : 'bg-[#ff3b30] shadow-[0_0_8px_rgba(255,59,48,0.5)]'}`}></span> 
                   {isConnected ? '系統已連線' : '系統未連線'}
                 </div>
                 <div className={`sm:hidden flex items-center justify-center w-8 h-8 rounded-full ${isConnected ? 'bg-[#34c759]/10' : 'bg-[#ff3b30]/10'}`}>
                   <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#34c759] animate-pulse shadow-[0_0_8px_rgba(52,199,89,0.5)]' : 'bg-[#ff3b30] shadow-[0_0_8px_rgba(255,59,48,0.5)]'}`}></span>
                 </div>
                 <button onClick={() => showToast('目前沒有新通知', 'info')} className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-white border border-[#d2d2d7]/50 shadow-sm hover:bg-[#f5f5f7] transition-colors text-[#1d1d1f] relative">
                   <Icon name="Bell" className="w-4 h-4" />
                   <span className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 w-2 h-2 bg-[#ff3b30] border-2 border-white rounded-full"></span>
                 </button>
               </div>
            </header>

            <div className="flex-1 p-4 sm:p-6 lg:p-10 overflow-auto relative scroll-smooth">
              {activeTab === 'dashboard' && <Dashboard tasks={accessibleTasks} materials={materials} />}
              {activeTab === 'settings' && <SettingsView users={users} isConnected={isConnected} />}
              {activeTab === 'vehicles' && <VehicleManager currentUser={currentUser} users={users} isConnected={isConnected} />}
              {activeTab === 'tasks' && !selectedTaskId && <TaskList tasks={accessibleTasks} materials={materials} onSelectTask={setSelectedTaskId} currentUser={currentUser} users={users} isConnected={isConnected} />}
              {activeTab === 'tasks' && selectedTaskId && activeTask && (
                <MaterialManagement task={activeTask} materials={taskMaterials} onBack={() => setSelectedTaskId(null)} onCount={setCountingMaterialId} onImportSuccess={handleImportSuccess} currentUser={currentUser} auditLogs={auditLogs.filter(l => l.task_id === activeTask.id)} isConnected={isConnected} />
              )}
              {activeTab === 'tasks' && countingMaterial && (
                <CountMode material={countingMaterial} onSave={handleSaveCount} onCancel={() => setCountingMaterialId(null)}/>
              )}
            </div>
          </main>

          <Modal isOpen={isAuthModalOpen} onClose={() => {setIsAuthModalOpen(false); setAuthPassword('');}} title="安全驗證">
            <form onSubmit={handleAuthSubmit} className="space-y-4 sm:space-y-5">
              <div className="text-xs sm:text-sm text-[#86868b] mb-3 sm:mb-4">進入後台管理系統需要管理者權限，請輸入管理者密碼。</div>
              <div><Input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="請輸入管理者密碼" className="text-center tracking-widest" autoFocus /></div>
              <div className="pt-4 flex justify-end space-x-3"><Button type="button" variant="secondary" onClick={() => {setIsAuthModalOpen(false); setAuthPassword('');}}>取消</Button><Button type="submit">確認</Button></div>
            </form>
          </Modal>
        </div>
      )}
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
```