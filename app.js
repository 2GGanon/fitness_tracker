// Minimal fitness tracker using localStorage
const STORAGE_KEY = 'fitness_tracker_data_v1'

function loadData(){
  const raw = localStorage.getItem(STORAGE_KEY)
  if(!raw) return {exercises: [], sessions: [], nutritionPresets: [], settings: {showExercises: false}}
  try{
    const parsed = JSON.parse(raw)
    if(!parsed.settings) parsed.settings = {showExercises:false}
    if(!Array.isArray(parsed.nutritionPresets)) parsed.nutritionPresets = []
    return parsed
  }catch(e){
    return {exercises: [], sessions: [], nutritionPresets: [], settings: {showExercises: false}}
  }
}

function saveData(data){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

const state = {data: loadData(), currentSession: null}

function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)}

function renderExercises(){
  const el = document.getElementById('exList')
  el.innerHTML = ''
  state.data.exercises.forEach((exObj, idx)=>{
    const name = exObj.name
    const d = document.createElement('div'); d.className='exercise'; d.dataset.index = idx
    const left = document.createElement('div'); left.className='exercise-details'
    const heading = document.createElement('strong'); heading.textContent = name
    left.appendChild(heading)
    const setPBs = Array.isArray(exObj.setPBs) ? exObj.setPBs : []
    setPBs.forEach((set, setIndex)=>{
      if(!set) return
      const pbRow = document.createElement('div'); pbRow.className='exercise-pb-row'
      const setLabel = document.createElement('span'); setLabel.className='exercise-pb-set'; setLabel.textContent=`Set ${setIndex + 1}`
      const details = document.createElement('span'); details.textContent=`${set.weight}${set.unit}×${set.reps || 0}`
      pbRow.appendChild(setLabel); pbRow.appendChild(details); left.appendChild(pbRow)
    })
    const controls = document.createElement('div'); controls.className='controls'
    const cancelBtn = document.createElement('button'); cancelBtn.textContent='Cancel'; cancelBtn.className='secondary hidden'; cancelBtn.onclick = ()=>{ renderExercises() }
    const confirmBtn = document.createElement('button'); confirmBtn.textContent='Confirm'; confirmBtn.className='confirm hidden'
    const editBtn = document.createElement('button'); editBtn.textContent='Edit'; editBtn.onclick=()=>openEditExerciseInline(idx)
    const deleteBtn = document.createElement('button'); deleteBtn.textContent='Delete'; deleteBtn.className='secondary'; deleteBtn.onclick=()=> deleteExercise(idx)
    controls.appendChild(confirmBtn); controls.appendChild(cancelBtn); controls.appendChild(editBtn); controls.appendChild(deleteBtn)
    d.appendChild(left); d.appendChild(controls)
    el.appendChild(d)
  })
}

function ensureExerciseObjects(){
  // migrate string entries to objects with optional overrides
  state.data.exercises = (state.data.exercises || []).map(e=>{
    const exercise = typeof e === 'string' ? {name: e, overrides:{}} : (e && e.name ? e : {name: String(e), overrides:{}})
    if(!Array.isArray(exercise.setPBs)) exercise.setPBs = []
    return exercise
  })
}

function updateExercisesVisibility(){
  const visible = !!state.data.settings?.showExercises
  const exCenter = document.getElementById('exList')
  const editor = document.getElementById('sessionEditor')
  const editorContent = document.getElementById('sessionEditorContent')
  const summary = document.getElementById('sessionSummary')
  const btn = document.getElementById('toggleExercisesBtn')
  if(visible){
    // clear any center summary and ensure diet view is closed when opening exercises
    clearCenterSummary()
    if(state.data.settings) state.data.settings.showDiet = false
    // persist any in-progress editor inputs before hiding the editor
    if(state.currentSession) { saveCurrentEditorToState(); saveData(state.data) }
    // show exercises in center, hide editor content and summary
    // explicitly hide diet center to avoid both showing
    const dietCenter = document.getElementById('dailyNutrition')
    if(dietCenter) dietCenter.classList.add('hidden')
    if(exCenter) exCenter.classList.remove('hidden')
    if(editor) editor.classList.remove('hidden')
    if(editorContent) editorContent.classList.add('hidden')
    if(summary) summary.classList.add('hidden')
    // render exercises content
    renderExercises()
    btn.setAttribute('aria-pressed','true')
    // record center view
    state.centerView = {type:'exercises'}
  }else{
    if(exCenter) exCenter.classList.add('hidden')
    // restore editor visibility depending on current session
    if(state.currentSession){
      // fully re-render the editor to restore inputs
      renderSessionEditor()
    } else if(editor) {
      editor.classList.add('hidden')
    }
    btn.setAttribute('aria-pressed','false')
    state.centerView = null
  }
}

function updateDietVisibility(){
  const visible = !!state.data.settings?.showDiet
  const dietCenter = document.getElementById('dailyNutrition')
  const editor = document.getElementById('sessionEditor')
  const editorContent = document.getElementById('sessionEditorContent')
  const summary = document.getElementById('sessionSummary')
  const btn = document.getElementById('toggleDietBtn')
  if(visible){
    // clear any center summary and ensure exercises view is closed when opening diet
    clearCenterSummary()
    if(state.currentSession){ saveCurrentEditorToState(); saveData(state.data) }
    // explicitly hide exercises center to avoid both showing
    const exCenter = document.getElementById('exList')
    if(exCenter) exCenter.classList.add('hidden')
    if(dietCenter) dietCenter.classList.remove('hidden')
    if(editor) editor.classList.remove('hidden')
    if(editorContent) editorContent.classList.add('hidden')
    if(summary) summary.classList.add('hidden')
    btn.setAttribute('aria-pressed','true')
    state.centerView = {type:'diet'}
    renderDailyNutrition()
  } else {
    if(dietCenter) dietCenter.classList.add('hidden')
    if(state.currentSession){ renderSessionEditor() }
    else if(editor) editor.classList.add('hidden')
    btn.setAttribute('aria-pressed','false')
    state.centerView = null
  }
}

function toggleDiet(){
  state.data.settings = state.data.settings || {}
  // toggle diet and ensure exercises view is closed
  state.data.settings.showDiet = !state.data.settings.showDiet
  state.data.settings.showExercises = false
  // record active nutrition date so the view remains active for today
  if(state.data.settings.showDiet){
    const todayKey = (new Date()).toISOString().split('T')[0]
    state.data.activeNutritionDate = todayKey
  }
  saveData(state.data)
  if(state.data.settings.showDiet) state.centerView = {type:'diet'}
  updateDietVisibility()
}

function renderDailyNutrition(){
  const list = document.getElementById('nutritionList')
  if(!list) return
  list.innerHTML = ''
  // prefer session nutrition if in a session
  if(state.currentSession && state.currentSession.nutrition && state.currentSession.nutrition.length){
    state.currentSession.nutrition.forEach(n=>{
      const row = document.createElement('div'); row.className='nutrition-item'
      row.innerHTML = `${n.name}: ${n.calories} cal` + (n.sugar_g ? ` • sugar ${n.sugar_g}g` : '') + (n.caffeine_g ? ` • caffeine ${n.caffeine_g}g` : '')
      const edit = document.createElement('button'); edit.textContent='Edit'; edit.onclick = ()=> editNutritionItem(n.id, null, true)
      const del = document.createElement('button'); del.textContent='Delete'; del.className='secondary'; del.onclick = ()=> deleteNutritionItem(n.id, null, true)
      row.appendChild(edit); row.appendChild(del)
      list.appendChild(row)
    })
  } else {
    const dateKey = (new Date()).toISOString().split('T')[0]
    const nutrit = (state.data.nutritionByDate && state.data.nutritionByDate[dateKey]) || []
    nutrit.forEach(n=>{
      const row = document.createElement('div'); row.className='nutrition-item'
      row.innerHTML = `${n.name}: ${n.calories} cal` + (n.sugar_g ? ` • sugar ${n.sugar_g}g` : '') + (n.caffeine_g ? ` • caffeine ${n.caffeine_g}g` : '')
      const edit = document.createElement('button'); edit.textContent='Edit'; edit.onclick = ()=> editNutritionItem(n.id, dateKey, false)
      const del = document.createElement('button'); del.textContent='Delete'; del.className='secondary'; del.onclick = ()=> deleteNutritionItem(n.id, dateKey, false)
      row.appendChild(edit); row.appendChild(del)
      list.appendChild(row)
    })
  }
}

function recordNutrition(){
  const nameEl = document.getElementById('nutritionName')
  const amtEl = document.getElementById('nutritionAmount')
  const unitEl = document.getElementById('nutritionUnit')
  const sugarEl = document.getElementById('nutritionSugar')
  const caffeineEl = document.getElementById('nutritionCaffeine')
  if(!nameEl || !amtEl || !unitEl) return
  const name = nameEl.value.trim()
  const amount = parseFloat(amtEl.value) || 0
  const unit = (unitEl.value || '').toLowerCase()
  const sugar = sugarEl ? (parseFloat(sugarEl.value) || 0) : 0
  const caffeine = caffeineEl ? (parseFloat(caffeineEl.value) || 0) : 0
  if(!name) return alert('Enter a food name')
  if(amount<=0) return alert('Enter a positive amount')
  // convert kJ to calories (approx): 1 kJ = 0.24 calories
  let calories = unit==='kj' ? Math.round(amount * 0.24) : Math.round(amount)
  const dateKey = (new Date()).toISOString().split('T')[0]
  const item = {id:uid(), name, amount, unit, calories, date: dateKey, sugar_g: sugar || undefined, caffeine_g: caffeine || undefined}
  if(state.currentSession){ state.currentSession.nutrition = state.currentSession.nutrition || []; state.currentSession.nutrition.push(item) }
  else { state.data.nutritionByDate = state.data.nutritionByDate || {}; state.data.nutritionByDate[dateKey] = state.data.nutritionByDate[dateKey] || []; state.data.nutritionByDate[dateKey].push(item) }
  saveData(state.data)
  // clear inputs
  nameEl.value=''; amtEl.value=''
  if(sugarEl) sugarEl.value=''
  if(caffeineEl) caffeineEl.value=''
  renderNutritionMenu()
  renderDailyNutrition(); renderCalendar(); renderExercises();
}

function renderNutritionMenu(selectedId){
  const select = document.getElementById('nutritionMenuSelect')
  const deleteBtn = document.getElementById('deleteNutritionPresetBtn')
  if(!select) return
  const presets = Array.isArray(state.data.nutritionPresets) ? state.data.nutritionPresets : []
  const requestedId = selectedId === undefined ? select.value : selectedId
  select.innerHTML = ''
  select.appendChild(new Option('Menu', ''))
  presets.forEach(preset=> select.appendChild(new Option(preset.name, preset.id)))
  select.value = presets.some(preset=>preset.id === requestedId) ? requestedId : ''
  if(deleteBtn) deleteBtn.disabled = !select.value
}

function applyNutritionPreset(){
  const select = document.getElementById('nutritionMenuSelect')
  const deleteBtn = document.getElementById('deleteNutritionPresetBtn')
  if(!select) return
  const preset = (state.data.nutritionPresets || []).find(item=>item.id === select.value)
  if(deleteBtn) deleteBtn.disabled = !preset
  if(!preset) return
  document.getElementById('nutritionName').value = preset.name
  document.getElementById('nutritionAmount').value = preset.amount
  document.getElementById('nutritionUnit').value = preset.unit === 'kj' ? 'kJ' : preset.unit
  document.getElementById('nutritionSugar').value = preset.sugar_g || ''
  document.getElementById('nutritionCaffeine').value = preset.caffeine_g || ''
}

function saveNutritionPreset(){
  const nameEl = document.getElementById('nutritionName')
  const amountEl = document.getElementById('nutritionAmount')
  const unitEl = document.getElementById('nutritionUnit')
  const sugarEl = document.getElementById('nutritionSugar')
  const caffeineEl = document.getElementById('nutritionCaffeine')
  const name = nameEl ? nameEl.value.trim() : ''
  const amount = amountEl ? (parseFloat(amountEl.value) || 0) : 0
  if(!name) return alert('Enter a food name')
  if(amount <= 0) return alert('Enter a positive amount')
  state.data.nutritionPresets = Array.isArray(state.data.nutritionPresets) ? state.data.nutritionPresets : []
  const existing = state.data.nutritionPresets.find(item=>item.name.toLowerCase() === name.toLowerCase())
  const preset = {
    id: existing ? existing.id : uid(),
    name,
    amount,
    unit: unitEl ? unitEl.value : 'calories',
    sugar_g: sugarEl ? (parseFloat(sugarEl.value) || undefined) : undefined,
    caffeine_g: caffeineEl ? (parseFloat(caffeineEl.value) || undefined) : undefined
  }
  if(existing) Object.assign(existing, preset)
  else state.data.nutritionPresets.push(preset)
  saveData(state.data)
  renderNutritionMenu(preset.id)
}

function deleteNutritionPreset(){
  const select = document.getElementById('nutritionMenuSelect')
  if(!select || !select.value) return alert('Select a Menu item to delete')
  state.data.nutritionPresets = (state.data.nutritionPresets || []).filter(item=>item.id !== select.value)
  saveData(state.data)
  renderNutritionMenu('')
}

function deleteNutritionItem(id, dateKey, inSession){
  const todayKey = (new Date()).toISOString().split('T')[0]
  if(!inSession && dateKey !== todayKey){ alert('Cannot modify past days\' nutrition.') ; return }
  if(inSession){
    if(!state.currentSession || !state.currentSession.nutrition) return
    state.currentSession.nutrition = state.currentSession.nutrition.filter(n=> n.id !== id)
  } else {
    if(!dateKey) return
    state.data.nutritionByDate = state.data.nutritionByDate || {}
    state.data.nutritionByDate[dateKey] = (state.data.nutritionByDate[dateKey]||[]).filter(n=> n.id !== id)
  }
  saveData(state.data)
  renderDailyNutrition(); renderCalendar(); renderExercises();
}

function editNutritionItem(id, dateKey, inSession){
  // populate input row with the item for editing; deletion of old then re-record on save
  const todayKey = (new Date()).toISOString().split('T')[0]
  if(!inSession && dateKey !== todayKey){ alert('Cannot edit past days\' nutrition.') ; return }
  let item = null
  if(inSession){ item = (state.currentSession.nutrition||[]).find(n=> n.id===id) }
  else { item = (state.data.nutritionByDate && state.data.nutritionByDate[dateKey]||[]).find(n=> n.id===id) }
  if(!item) return
  document.getElementById('nutritionName').value = item.name
  document.getElementById('nutritionAmount').value = item.amount
  document.getElementById('nutritionUnit').value = item.unit || 'calories'
  if(document.getElementById('nutritionSugar')) document.getElementById('nutritionSugar').value = item.sugar_g || ''
  if(document.getElementById('nutritionCaffeine')) document.getElementById('nutritionCaffeine').value = item.caffeine_g || ''
  // remove existing item; user can modify then press Record to re-add
  deleteNutritionItem(id, dateKey, inSession)
}

function toggleExercises(){
  state.data.settings = state.data.settings || {}
    // toggle exercises and ensure diet is closed
    state.data.settings.showExercises = !state.data.settings.showExercises
    state.data.settings.showDiet = false
  saveData(state.data)
  // when showing exercises, ensure any center summary is cleared
  if(state.data.settings.showExercises) state.centerView = {type:'exercises'}
  updateExercisesVisibility()
}

function computeAllPBs(){
  const pbs = {}
  state.data.exercises.forEach(obj=> pbs[obj.name]={})
  state.data.sessions.forEach(s=>{
    Object.keys(s.entries||{}).forEach(ex=>{
      const sets = s.entries[ex]
      sets.forEach(set=>{
        const pb = pbs[ex] || (pbs[ex]={})
        const unitLower = set.unit ? set.unit.toLowerCase() : ''
        // weight PBs
        if(unitLower==='kg' || unitLower==='lbs'){
          const norm = unitLower==='lbs' ? (set.weight * 0.45359237) : set.weight
          const vol = norm * set.reps
          if(!pb.heaviest || norm> (pb.heaviest._norm||0)) pb.heaviest = {...set, date:s.date, _norm: norm}
          if(!pb.highReps || set.reps>pb.highReps.reps) pb.highReps = {...set, date:s.date, _norm: norm}
          if(!pb.highVolume || vol>pb.highVolume._volume) pb.highVolume = {volume:vol, ...set, date:s.date, _volume: vol, _norm: norm}
        }
        // time PBs (lower is better)
        else if(unitLower==='s' || unitLower==='min'){
          const seconds = unitLower==='min' ? (set.weight * 60) : set.weight
          if(!pb.bestTime || seconds < (pb.bestTime._norm||Infinity)) pb.bestTime = {...set, date:s.date, _norm: seconds}
        }
        // distance PBs (higher is better), normalize to km for comparison
        else if(unitLower==='km' || unitLower==='miles'){
          const km = unitLower==='miles' ? (set.weight * 1.609344) : set.weight
          if(!pb.longestDistance || km > (pb.longestDistance._norm||0)) pb.longestDistance = {...set, date:s.date, _norm: km}
        }
      })
    })
  })
  // apply any manual overrides from exercise objects
  applyExerciseOverrides(pbs)
  return pbs
}

  // apply overrides from exercise objects
function applyExerciseOverrides(pbs){
  state.data.exercises.forEach(exObj=>{
    const name = exObj.name
    const ov = exObj.overrides || {}
    if(!pbs[name]) pbs[name] = {}
    if(ov.heaviest) pbs[name].heaviest = ov.heaviest
    if(ov.highReps) pbs[name].highReps = ov.highReps
    if(ov.highVolume) pbs[name].highVolume = ov.highVolume
    if(ov.bestTime) pbs[name].bestTime = ov.bestTime
    if(ov.longestDistance) pbs[name].longestDistance = ov.longestDistance
  })
}

function addExercise(name){
  name = name.trim()
  if(!name) return
  if(!state.data.exercises.some(e=> e.name === name)){
    state.data.exercises.push({name, overrides:{}, setPBs:[]})
    saveData(state.data)
    renderExercises(); renderCalendar()
  }
}

function formatSessionDateTime(value){
  const rounded = new Date(value)
  if(Number.isNaN(rounded.getTime())) return ''
  rounded.setMinutes(rounded.getMinutes() >= 30 ? 60 : 0, 0, 0)
  return rounded.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric'
  })
}

function startNewSession(){
  // if there's an existing in-progress session, show/return to it instead
  if(state.currentSession){
    // simply ensure editor is visible
    document.getElementById('sessionEditor').classList.remove('hidden')
    clearCenterSummary()
    renderSessionEditor()
    return
  }
  state.currentSession = {id:uid(), date:(new Date()).toISOString(), entries:{}}
  document.getElementById('sessionDate').textContent = formatSessionDateTime(state.currentSession.date)
  document.getElementById('sessionEditor').classList.remove('hidden')
  clearCenterSummary()
  renderSessionEditor()
}

function startSessionAndOpenFor(exName){
  startNewSession()
  const select = document.getElementById('sessionExerciseSelect')
  if(select){
    Array.from(select.options).forEach((opt,i)=>{ if(opt.value===exName) select.selectedIndex=i })
    prepareSetsForSelected()
  }
}
function renderSessionEditor(){
  const sessionDate = document.getElementById('sessionDate')
  if(sessionDate && state.currentSession) sessionDate.textContent = formatSessionDateTime(state.currentSession.date)
  const select = document.getElementById('sessionExerciseSelect')
  select.innerHTML = ''
  state.data.exercises.forEach(exObj=>{
    const opt = document.createElement('option'); opt.value = exObj.name; opt.textContent = exObj.name
    select.appendChild(opt)
  })
  select.onchange = prepareSetsForSelected
  const addSetBtn = document.getElementById('addSetBtn'); if(addSetBtn) addSetBtn.onclick = ()=> addSetRow()
  const removeSetBtn = document.getElementById('removeSetBtn'); if(removeSetBtn) removeSetBtn.onclick = ()=> removeLastSet()
  const addExerciseBtn = document.getElementById('addExerciseToSessionBtn'); if(addExerciseBtn) addExerciseBtn.onclick = ()=> addSelectedExerciseToSession()

  if(select.options.length>0){
    // if there's a last-edited exercise in the current session, restore it
    const last = state.currentSession?._lastEditedExercise
    if(last){
      const found = Array.from(select.options).findIndex(o=>o.value===last)
      if(found>=0) select.selectedIndex = found, editSessionEntry(last)
      else { select.selectedIndex = 0; prepareSetsForSelected() }
    } else {
      select.selectedIndex = 0
      prepareSetsForSelected()
    }
  }
  // hide exercises center when showing editor
  const exCenter = document.getElementById('exList')
  if(exCenter) exCenter.classList.add('hidden')
  const dietCenter = document.getElementById('dailyNutrition')
  if(dietCenter) dietCenter.classList.add('hidden')
  renderSessionEntriesList()
}

function collectRawEditorState(){
  const select = document.getElementById('sessionExerciseSelect')
  const wrap = document.getElementById('setsContainer')
  if(!select || !wrap) return null
  const name = select.value
  const sets = []
  wrap.querySelectorAll('.set-row').forEach(row=>{
    const inputs = row.querySelectorAll('input,select')
    const weight = inputs[0]?.value || ''
    const unit = inputs[1] && inputs[1].tagName.toLowerCase()==='select' ? inputs[1].value : 'kg'
    const reps = inputs[2]?.value || ''
    sets.push({weight, unit, reps})
  })
  return {name, sets}
}

function saveCurrentEditorToState(){
  if(!state.currentSession) return
  const raw = collectRawEditorState()
  if(!raw) return
  // save even empty strings so input is preserved; but don't create empty-named entries
  if(!raw.name) return
  state.currentSession.entries = state.currentSession.entries || {}
  state.currentSession.entries[raw.name] = raw.sets
  state.currentSession._lastEditedExercise = raw.name
}

function prepareSetsForSelected(){
  const name = document.getElementById('sessionExerciseSelect').value
  const setsContainer = document.getElementById('setsContainer')
  setsContainer.innerHTML = ''
  const defaultUnit = getMostRecentUnitForExercise(name)
  for(let i=0;i<3;i++) createSetRow('setsContainer', '', '', defaultUnit)
}

function getSetPB(exName, setIndex){
  const exercise = (state.data.exercises || []).find(item=>item.name === exName)
  return exercise && Array.isArray(exercise.setPBs) ? (exercise.setPBs[setIndex] || null) : null
}

function saveSetPB(exName, setIndex, weight, unit, reps){
  const exercise = (state.data.exercises || []).find(item=>item.name === exName)
  const value = parseFloat(weight) || 0
  const repetitionCount = parseInt(reps) || 0
  if(!exercise || value <= 0 || repetitionCount <= 0) return null
  if(!Array.isArray(exercise.setPBs)) exercise.setPBs = []
  const pb = {
    setNumber: setIndex + 1,
    weight: value,
    unit: unit || 'kg',
    reps: repetitionCount,
    date: state.currentSession?.date || (new Date()).toISOString()
  }
  exercise.setPBs[setIndex] = pb
  saveData(state.data)
  if(document.getElementById('exList')) renderExercises()
  return pb
}

function formatSetPB(exName, setIndex){
  const pb = getSetPB(exName, setIndex)
  if(!pb) return 'PB —'
  return `PB ${pb.weight}${pb.unit}×${pb.reps || 0}`
}

function createSetRow(containerId,weight='',reps='',unit='kg'){
  const wrap = document.getElementById(containerId)
  if(!wrap) return
  const setIndex = wrap.querySelectorAll('.set-row').length
  const exerciseSelect = document.getElementById('sessionExerciseSelect')
  const exerciseName = exerciseSelect ? exerciseSelect.value : ''
  const row = document.createElement('div'); row.className='set-row'
  const w = document.createElement('input'); w.className='set-weight'; w.placeholder='weight'; w.value=weight; w.type='number'; w.min='0'
  const unitSel = document.createElement('select'); unitSel.innerHTML = '<option>kg</option><option>lbs</option><option>s</option><option>min</option><option>km</option><option>miles</option>'; unitSel.value = unit
  const r = document.createElement('input'); r.className='set-reps'; r.placeholder='reps'; r.value=reps; r.type='number'; r.min='0'
  const pb = document.createElement('span'); pb.className='set-pb'; pb.title=`Personal best for set ${setIndex + 1}`
  const star = document.createElement('button'); star.className='set-pb-star'; star.type='button'; star.setAttribute('aria-label', `Set row ${setIndex + 1} as personal best`)
  const updatePB = ()=>{
    const savedPB = getSetPB(exerciseName, setIndex)
    pb.textContent = formatSetPB(exerciseName, setIndex)
    const matches = !!savedPB
      && Number(savedPB.weight) === (parseFloat(w.value) || 0)
      && savedPB.unit === unitSel.value
      && Number(savedPB.reps) === (parseInt(r.value) || 0)
    star.textContent = matches ? '★' : '☆'
    star.classList.toggle('active', matches)
    star.setAttribute('aria-pressed', matches ? 'true' : 'false')
  }
  star.onclick = ()=>{
    if(!saveSetPB(exerciseName, setIndex, w.value, unitSel.value, r.value)){
      alert('Enter a value and reps before setting a PB.')
      return
    }
    updatePB()
  }
  unitSel.addEventListener('change', updatePB)
  w.addEventListener('input', updatePB)
  r.addEventListener('input', updatePB)
  row.appendChild(w); row.appendChild(unitSel); row.appendChild(r); row.appendChild(pb); row.appendChild(star)
  wrap.appendChild(row)
  updatePB()
}

function addSetRow(){
  const select = document.getElementById('sessionExerciseSelect')
  const name = select ? select.value : null
  const wrap = document.getElementById('setsContainer')
  let unit = 'kg'
  // prefer the last existing row's unit if present (keeps user's recent choice in-session)
  if(wrap){
    const rows = wrap.querySelectorAll('.set-row')
    if(rows.length>0){
      const last = rows[rows.length-1]
      const sel = last.querySelector('select')
      if(sel) unit = sel.value
    } else if(name){
      unit = getMostRecentUnitForExercise(name)
    }
  }
  createSetRow('setsContainer','', '', unit)
}

function getMostRecentUnitForExercise(exName){
  if(!exName) return 'kg'
  // check current in-progress session first
  if(state.currentSession && state.currentSession.entries && state.currentSession.entries[exName]){
    const sets = state.currentSession.entries[exName]
    if(sets && sets.length){
      const last = sets[sets.length-1]
      if(last && last.unit) return last.unit
    }
  }
  // check saved sessions (most recent first)
  for(let i=0;i<(state.data.sessions||[]).length;i++){
    const s = state.data.sessions[i]
    const sets = s.entries && s.entries[exName]
    if(sets && sets.length){
      const last = sets[sets.length-1]
      if(last && last.unit) return last.unit
    }
  }
  return 'kg'
}

function removeLastSet(){
  const wrap = document.getElementById('setsContainer')
  const rows = wrap.querySelectorAll('.set-row')
  if(rows.length>0) rows[rows.length-1].remove()
}

function collectSetsFromEditor(){
  const name = document.getElementById('sessionExerciseSelect').value
  const wrap = document.getElementById('setsContainer')
  const sets = []
  wrap.querySelectorAll('.set-row').forEach(row=>{
    const inputs = row.querySelectorAll('input,select')
    const weight = parseFloat(inputs[0].value) || 0
    const unit = inputs[1].tagName.toLowerCase()==='select' ? inputs[1].value : 'kg'
    const reps = parseInt(inputs[2].value) || 0
    if(weight>0 && reps>0) {
      const unitLower = unit ? unit.toLowerCase() : ''
      let norm = null
      if(unitLower==='kg' || unitLower==='lbs') norm = unitLower==='lbs' ? weight * 0.45359237 : weight
      sets.push({weight, unit, reps, normalizedKg: norm})
    }
  })
  return {name, sets}
}

function addSelectedExerciseToSession(){
  if(!state.currentSession) startNewSession()
  const {name, sets} = collectSetsFromEditor()
  if(!sets.length){ alert('Add at least one set with weight and reps.') ; return }
  state.currentSession.entries[name] = sets
  renderSessionEntriesList()
  renderExercises()
}

function renderSessionEntriesList(){
  const el = document.getElementById('sessionEntriesList')
  el.innerHTML = ''
  const entries = state.currentSession?.entries || {}
  Object.keys(entries).forEach(ex=>{
    const d = document.createElement('div'); d.className='session-entries-row'
    const details = document.createElement('div'); details.className='session-entry-details'
    const heading = document.createElement('strong'); heading.textContent=ex
    details.appendChild(heading)
    entries[ex].forEach((set, setIndex)=>{
      const setRow = document.createElement('small'); setRow.className='session-entry-set'; setRow.textContent=`Set ${setIndex + 1}: ${set.weight}${set.unit}×${set.reps}`
      details.appendChild(setRow)
    })
    const controls = document.createElement('div'); controls.className='session-entry-controls'
    const edit = document.createElement('button'); edit.textContent='Edit'; edit.onclick=()=>{
      editSessionEntry(ex)
      document.querySelectorAll('.session-entries-row.editing').forEach(row=>row.classList.remove('editing'))
      d.classList.add('editing')
    }
    const remove = document.createElement('button'); remove.textContent='Remove'; remove.className='secondary'; remove.onclick=()=>{ delete state.currentSession.entries[ex]; renderSessionEntriesList(); renderExercises() }
    controls.appendChild(edit); controls.appendChild(remove)
    d.appendChild(details); d.appendChild(controls)
    el.appendChild(d)
  })
}

function editSessionEntry(ex){
  const select = document.getElementById('sessionExerciseSelect')
  if(!select || !state.currentSession?.entries?.[ex]) return
  const selectedIndex = Array.from(select.options).findIndex(option=>option.value === ex)
  if(selectedIndex < 0) return
  select.selectedIndex = selectedIndex
  state.currentSession._lastEditedExercise = ex
  const sets = state.currentSession.entries[ex] || []
  const wrap = document.getElementById('setsContainer'); wrap.innerHTML = ''
  sets.forEach(s=> createSetRow('setsContainer', s.weight, s.reps, s.unit))
  const firstInput = wrap.querySelector('.set-weight')
  if(firstInput) firstInput.focus()
}

function collectSessionFromEditor(){
  // prefer state.currentSession.entries managed via Add to Session
  return state.currentSession?.entries || {}
}

function saveSession(){
  if(!state.currentSession) return
  const entries = state.currentSession?.entries || {}
  if(Object.keys(entries).length===0){
    alert('No sets recorded for this session.')
    return
  }
  state.data.sessions.unshift(state.currentSession)
  saveData(state.data)
  state.currentSession = null
  document.getElementById('sessionEditor').classList.add('hidden')
  onSessionsChanged()
}

function cancelSession(){
  if(!state.currentSession){
    document.getElementById('sessionEditor').classList.add('hidden')
    return
  }
  // If this current session has been persisted in state.data.sessions, remove it
  if(state.data && Array.isArray(state.data.sessions)){
    const idx = state.data.sessions.findIndex(s=> s.id === state.currentSession.id)
    if(idx>=0){
      state.data.sessions.splice(idx,1)
      saveData(state.data)
    }
  }
  state.currentSession = null
  document.getElementById('sessionEditor').classList.add('hidden')
  onSessionsChanged()
}

// ensure UI updates when sessions change
function onSessionsChanged(){
  renderExercises(); renderCalendar(); updateNewSessionButton()
}

function getSessionsByDate(){
  const byDate = {}
  state.data.sessions.forEach(s=>{
    const dateKey = (s.date||'').split('T')[0]
    if(!byDate[dateKey]) byDate[dateKey] = []
    byDate[dateKey].push(s)
  })
  return byDate
}

function renderCalendar(year, month){
  // if month/year not provided, use today
  const now = new Date()
  // prefer explicit args; otherwise read from selectors if present; fallback to today
  const monthSel = document.getElementById('monthSelect')
  const yearSel = document.getElementById('yearSelect')
  year = (typeof year === 'number') ? year : (yearSel ? parseInt(yearSel.value) : now.getFullYear())
  month = (typeof month === 'number') ? month : (monthSel ? parseInt(monthSel.value) : now.getMonth())

  const first = new Date(year, month, 1)
  const startDay = first.getDay() // 0-6 Sun-Sat
  const daysInMonth = new Date(year, month+1, 0).getDate()

  const grid = document.getElementById('calendarGrid')
  grid.innerHTML = ''

  const monthLabel = document.getElementById('calendarMonthLabel')
  if(monthLabel) monthLabel.textContent = first.toLocaleString(undefined, {month:'long', year:'numeric'})

  const sessionsByDate = getSessionsByDate()

  // render weekday headers
  const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  weekdays.forEach(w=>{
    const h = document.createElement('div'); h.className='day header'; h.textContent = w; grid.appendChild(h)
  })

  // pad previous month days
  for(let i=0;i<startDay;i++){
    const cell = document.createElement('div'); cell.className='day other-month'; grid.appendChild(cell)
  }

  for(let d=1; d<=daysInMonth; d++){
    const date = new Date(year, month, d)
    const key = date.toISOString().split('T')[0]
    const cell = document.createElement('div'); cell.className='day';
    const num = document.createElement('div'); num.className='date-num'; num.textContent = d
    cell.appendChild(num)
    if(sessionsByDate[key]){
      cell.classList.add('has-session')
      cell.onclick = ()=> showDaySummary(key, cell)
    } else {
      cell.onclick = ()=> showDaySummary(key, cell)
    }
    grid.appendChild(cell)
  }

  // keep selectors in sync when present
  const monthSel2 = document.getElementById('monthSelect')
  const yearSel2 = document.getElementById('yearSelect')
  if(monthSel2) monthSel2.value = String(month)
  if(yearSel2) yearSel2.value = String(year)
}

function populateMonthYearSelectors(){
  const monthSel = document.getElementById('monthSelect')
  const yearSel = document.getElementById('yearSelect')
  if(!monthSel || !yearSel) return
  const now = new Date()
  const currentYear = now.getFullYear()
  // months
  monthSel.innerHTML = ''
  const monthNames = []
  for(let m=0;m<12;m++) monthNames.push(new Date(2000,m,1).toLocaleString(undefined,{month:'long'}))
  monthNames.forEach((name,idx)=>{ const o = document.createElement('option'); o.value=String(idx); o.textContent = name; monthSel.appendChild(o) })
  // years range: currentYear-5 .. currentYear+5
  yearSel.innerHTML = ''
  for(let y=currentYear-5;y<=currentYear+5;y++){ const o = document.createElement('option'); o.value=String(y); o.textContent=String(y); yearSel.appendChild(o) }
  // default to current
  monthSel.value = String(now.getMonth())
  yearSel.value = String(now.getFullYear())
  monthSel.onchange = ()=> renderCalendar()
  yearSel.onchange = ()=> renderCalendar()
}

function showDaySummary(dateKey, cell){
  // highlight selection
  document.querySelectorAll('.calendar-grid .day').forEach(n=>n.classList.remove('selected'))
  if(cell) cell.classList.add('selected')
  const summary = document.getElementById('daySummary')
  const sessionsByDate = getSessionsByDate()
  const sessions = sessionsByDate[dateKey] || []
  summary.innerHTML = ''
  if(sessions.length){
    sessions.forEach((s, idx)=>{
      const entry = document.createElement('div')
      entry.className = 'entry'
      const header = document.createElement('button')
      header.className = 'toggle-session'
      header.textContent = String(idx+1)
      header.onclick = ()=>{
        // show this session in center session area
        showCenterSessionSummary(s)
      }
      entry.appendChild(header)
      summary.appendChild(entry)
    })
  }

  // also show any standalone daily nutrition entries for the date
  const nutrit = (state.data.nutritionByDate && state.data.nutritionByDate[dateKey]) || []
  if(nutrit.length){
    // show a single button to open the nutrition summary in the center
    const entry = document.createElement('div')
    entry.className = 'entry'
    const openBtn = document.createElement('button')
    openBtn.className = 'toggle-session'
    openBtn.textContent = 'Diet'
    openBtn.onclick = ()=> showCenterNutritionSummary(dateKey)
    entry.appendChild(openBtn)
    summary.appendChild(entry)
  }
}

function showCenterNutritionSummary(dateKey){
  const editor = document.getElementById('sessionEditor')
  const editorContent = document.getElementById('sessionEditorContent')
  const summary = document.getElementById('sessionSummary')
  if(!summary) return
  // hide editor content and exercises/diet center
  if(state.currentSession) saveCurrentEditorToState()
  const exCenter = document.getElementById('exList')
  const dietCenter = document.getElementById('dailyNutrition')
  if(exCenter) exCenter.classList.add('hidden')
  if(dietCenter) dietCenter.classList.add('hidden')
  if(editorContent) editorContent.classList.add('hidden')
  summary.innerHTML = ''
  const title = document.createElement('h4')
  title.textContent = `Nutrition — ${new Date(dateKey).toLocaleDateString()}`
  summary.appendChild(title)
  const nutrit = (state.data.nutritionByDate && state.data.nutritionByDate[dateKey]) || []
  nutrit.forEach(n=>{
    const row = document.createElement('div')
    row.textContent = `${n.name}: ${n.calories} cal` + (n.sugar_g ? ` • sugar ${n.sugar_g}g` : '') + (n.caffeine_g ? ` • caffeine ${n.caffeine_g}g` : '')
    summary.appendChild(row)
  })
  if(editor) editor.classList.remove('hidden')
  summary.classList.remove('hidden')
  state.centerView = {type:'nutritionSummary', dateKey}
  updateNewSessionButton()
  // make main buttons uniform width based on the Exercises & PBs button
  try{ equalizeMainButtonSizes() }catch(e){}
  window.addEventListener('resize', ()=>{ try{ equalizeMainButtonSizes() }catch(e){} })
}

function showCenterSessionSummary(session){
  // hide editor content, show summary in center
  const editor = document.getElementById('sessionEditor')
  const editorContent = document.getElementById('sessionEditorContent')
  const summary = document.getElementById('sessionSummary')
  if(!editor || !summary || !editorContent) return
  // if there's an in-progress session, persist current editor inputs before hiding
  if(state.currentSession) saveCurrentEditorToState()
  // populate summary
  summary.innerHTML = ''
  const title = document.createElement('h4')
  title.textContent = new Date(session.date).toLocaleDateString()
  summary.appendChild(title)
  Object.keys(session.entries||{}).forEach(ex=>{
    const sets = session.entries[ex].map(st=>`${st.weight}${st.unit}×${st.reps}`).join(', ')
    const row = document.createElement('div')
    row.textContent = `${ex}: ${sets}`
    summary.appendChild(row)
  })
  // show nutrition attached to this session if present
  if(session.nutrition && session.nutrition.length){
    const ntitle = document.createElement('h4')
    ntitle.textContent = 'Nutrition'
    summary.appendChild(ntitle)
    session.nutrition.forEach(n=>{
      const row = document.createElement('div')
      row.textContent = `${n.name}: ${n.calories} cal`
      summary.appendChild(row)
    })
  }
  // show summary, hide editor content and exercises list
  editorContent.classList.add('hidden')
  const exCenter = document.getElementById('exList')
  if(exCenter) exCenter.classList.add('hidden')
  summary.classList.remove('hidden')
  editor.classList.remove('hidden')
  // indicate that a center summary is active
  state.centerView = {type:'summary', sessionId: session.id}
  updateNewSessionButton()
}

function clearCenterSummary(){
  const editorContent = document.getElementById('sessionEditorContent')
  const summary = document.getElementById('sessionSummary')
  if(summary) summary.classList.add('hidden')
  if(editorContent) editorContent.classList.remove('hidden')
  // if there is an in-progress session, restore its editor state
  if(state.currentSession) renderSessionEditor()
  state.centerView = null
  updateNewSessionButton()
}

function updateNewSessionButton(){
  const btn = document.getElementById('newSessionBtn')
  if(!btn) return
  if(state.currentSession){
    btn.textContent = state.centerView && state.centerView.type==='summary' ? 'Resume Session' : 'Resume Session'
  } else {
    btn.textContent = 'Start Session'
  }
}

// Set all main buttons to the width of the Exercises & PBs button so they match
function equalizeMainButtonSizes(){
  const ref = document.getElementById('toggleExercisesBtn')
  const bar = document.getElementById('mainButtonsBar')
  if(!ref || !bar) return
  const buttons = Array.from(bar.querySelectorAll('button'))
  // clear any previous inline widths so we can measure natural size
  buttons.forEach(b=> b.style.width = '')

  // helper to measure and apply width; retry a couple times if measurement is 0
  function measureAndApply(attempt){
    const rect = ref.getBoundingClientRect()
    const w = Math.round(rect.width || 0)
    if(w <= 0 && attempt < 5){
      // schedule another attempt after a short delay
      setTimeout(()=> measureAndApply(attempt+1), 50)
      return
    }
    const finalW = Math.max(w, 72)
    buttons.forEach(b=> { b.style.width = finalW + 'px' })
  }
  // try on next frame to allow layout to stabilise
  requestAnimationFrame(()=> measureAndApply(0))
}

// also ensure sizing after full load (fonts/resources)
window.addEventListener('load', ()=>{ try{ equalizeMainButtonSizes() }catch(e){} })

function openEditExerciseInline(idx){
  const exObj = state.data.exercises[idx]
  if(!exObj) return
  if(!Array.isArray(exObj.setPBs)) exObj.setPBs = []
  const container = document.querySelector(`#exList .exercise[data-index='${idx}']`)
  if(!container) return
  const left = container.querySelector('.exercise-details')
  left.innerHTML = ''
  const nameInput = document.createElement('input'); nameInput.className='exercise-name-input'; nameInput.value = exObj.name; nameInput.setAttribute('aria-label','Exercise name')
  left.appendChild(nameInput)
  const pbEditors = []
  ;(exObj.setPBs || []).forEach((set, setIndex)=>{
    if(!set) return
    const pbRow = document.createElement('div'); pbRow.className='exercise-pb-row'
    const setLabel = document.createElement('span'); setLabel.className='exercise-pb-set'; setLabel.textContent=`Set ${setIndex + 1}`
    const valueInput = document.createElement('input'); valueInput.className='exercise-pb-value'; valueInput.type='number'; valueInput.min='0'; valueInput.value=set.weight; valueInput.setAttribute('aria-label',`Set ${setIndex + 1} value`)
    const unitSelect = document.createElement('select'); unitSelect.className='exercise-pb-unit'; unitSelect.innerHTML='<option>kg</option><option>lbs</option><option>s</option><option>min</option><option>km</option><option>miles</option>'; unitSelect.value=set.unit
    const times = document.createElement('span'); times.textContent='×'
    const repsInput = document.createElement('input'); repsInput.className='exercise-pb-reps'; repsInput.type='number'; repsInput.min='0'; repsInput.value=set.reps; repsInput.setAttribute('aria-label',`Set ${setIndex + 1} reps`)
    pbRow.appendChild(setLabel); pbRow.appendChild(valueInput); pbRow.appendChild(unitSelect); pbRow.appendChild(times); pbRow.appendChild(repsInput)
    left.appendChild(pbRow)
    pbEditors.push({set, setIndex, valueInput, unitSelect, repsInput})
  })

  const controls = container.querySelector('.controls')
  if(controls){
    controls.classList.add('editing')
    const cancelBtnControl = controls.querySelector('.secondary')
    const confirmBtnControl = controls.querySelector('.confirm')
    const controlButtons = controls.querySelectorAll('button')
    const editBtnControl = controlButtons[2]
    const deleteBtnControl = controlButtons[3]
    if(cancelBtnControl) cancelBtnControl.classList.remove('hidden')
    if(confirmBtnControl) confirmBtnControl.classList.remove('hidden')
    if(editBtnControl) editBtnControl.classList.add('hidden')
    if(deleteBtnControl) deleteBtnControl.classList.add('hidden')
    confirmBtnControl.onclick = ()=> performSave()
  }

  function performSave(){
    const newName = nameInput.value.trim()
    if(!newName) return alert('Name required')
    const pbUpdates = pbEditors.map(editor=>({
      ...editor,
      value: parseFloat(editor.valueInput.value) || 0,
      reps: parseInt(editor.repsInput.value) || 0
    }))
    const invalid = pbUpdates.find(editor=>editor.value <= 0 || editor.reps <= 0)
    if(invalid) return alert(`Enter a value and reps for Set ${invalid.setIndex + 1}`)
    pbUpdates.forEach(editor=>{
      exObj.setPBs[editor.setIndex] = {...editor.set, setNumber:editor.setIndex + 1, weight:editor.value, unit:editor.unitSelect.value, reps:editor.reps}
    })
    exObj.name = newName
    saveData(state.data)
    renderExercises(); renderSessionEditor(); renderCalendar()
  }
}

function deleteExercise(idx){
  const exObj = state.data.exercises[idx]
  if(!exObj) return
  const ok = confirm(`Delete exercise "${exObj.name}"? This will remove it from the exercise list but will NOT delete past session records.`)
  if(!ok) return
  state.data.exercises.splice(idx,1)
  saveData(state.data)
  renderExercises(); renderSessionEditor(); onSessionsChanged()
}

function showAddExerciseInput(){
  const modal = document.getElementById('addExerciseModal')
  const input = document.getElementById('modalExerciseName')
  if(modal){
    modal.classList.remove('hidden')
    if(input){ input.value=''; input.focus() }
  }
}

function hideAddExerciseInput(){
  const modal = document.getElementById('addExerciseModal')
  const input = document.getElementById('modalExerciseName')
  if(modal){
    modal.classList.add('hidden')
    if(input) input.value = ''
  }
}

function confirmAddExercise(){
  const input = document.getElementById('modalExerciseName')
  if(!input) return
  const name = input.value.trim()
  if(!name) return
  addExercise(name)
  hideAddExerciseInput()
}

function init(){
  try{ console.log('app.js init') }catch(e){}
  document.getElementById('addExerciseBtn').onclick = ()=> showAddExerciseInput()
  const confirmBtn = document.getElementById('modalConfirmAddExerciseBtn')
  const cancelBtn = document.getElementById('modalCancelAddExerciseBtn')
  if(confirmBtn) confirmBtn.onclick = confirmAddExercise
  if(cancelBtn) cancelBtn.onclick = hideAddExerciseInput
  const input = document.getElementById('modalExerciseName')
  if(input) input.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') confirmAddExercise() })
  document.getElementById('newSessionBtn').onclick = ()=> startNewSession()
  document.getElementById('saveSessionBtn').onclick = ()=> saveSession()
  document.getElementById('cancelSessionBtn').onclick = ()=> cancelSession()
  const toggleBtn = document.getElementById('toggleExercisesBtn')
  if(toggleBtn) toggleBtn.addEventListener('click', toggleExercises)
  const toggleDietBtn = document.getElementById('toggleDietBtn')
  if(toggleDietBtn) toggleDietBtn.addEventListener('click', toggleDiet)
  const nutritionRecordBtn = document.getElementById('nutritionRecordBtn')
  if(nutritionRecordBtn) nutritionRecordBtn.addEventListener('click', recordNutrition)
  const nutritionPresetBtn = document.getElementById('nutritionPresetBtn')
  if(nutritionPresetBtn) nutritionPresetBtn.addEventListener('click', saveNutritionPreset)
  const nutritionMenuSelect = document.getElementById('nutritionMenuSelect')
  if(nutritionMenuSelect) nutritionMenuSelect.addEventListener('change', applyNutritionPreset)
  const deleteNutritionPresetBtn = document.getElementById('deleteNutritionPresetBtn')
  if(deleteNutritionPresetBtn) deleteNutritionPresetBtn.addEventListener('click', deleteNutritionPreset)
  // (export/import removed)
  const toggleCalendarBtn = document.getElementById('toggleCalendarBtn')
  if(toggleCalendarBtn) toggleCalendarBtn.addEventListener('click', toggleCalendar)
  // ensure function is available to inline onclick as well
  window.toggleCalendar = toggleCalendar
  updateExercisesVisibility()
  // auto-finish diet view if the active date has passed
  const todayKey = (new Date()).toISOString().split('T')[0]
  if(state.data && state.data.activeNutritionDate && state.data.activeNutritionDate !== todayKey){
    state.data.settings = state.data.settings || {}
    state.data.settings.showDiet = false
    delete state.data.activeNutritionDate
    saveData(state.data)
  }
  updateDietVisibility()
  // register service worker for PWA/offline support
  registerServiceWorker()
  // ensure add-exercise modal is hidden by default
  hideAddExerciseInput()
  // migrate exercises to object form if needed
  ensureExerciseObjects()
  renderExercises();
  renderNutritionMenu()
  // populate month/year dropdowns for calendar navigation
  populateMonthYearSelectors()
  updateCalendarVisibility()
  renderCalendar()
  updateNewSessionButton()
}

function toggleCalendar(){
  try{
    console.log('toggleCalendar invoked. current settings:', state.data.settings)
    // immediate DOM toggle for responsiveness
    const historyEl = document.getElementById('history')
    if(historyEl){
      historyEl.classList.toggle('hidden')
    }
    // compute visible state from DOM so we reflect reality
    const visible = historyEl ? !historyEl.classList.contains('hidden') : false
    state.data.settings = state.data.settings || {}
    state.data.settings.showCalendar = visible
    console.log('toggleCalendar new showCalendar=', state.data.settings.showCalendar)
    saveData(state.data)
    // sync UI attributes/labels
    updateCalendarVisibility()
  }catch(e){ console.error('toggleCalendar error', e) }
}

function updateCalendarVisibility(){
  const history = document.getElementById('history')
  const btn = document.getElementById('toggleCalendarBtn')
  const visible = state.data.settings ? (state.data.settings.showCalendar === undefined ? true : !!state.data.settings.showCalendar) : true
  if(history){
    if(visible) history.classList.remove('hidden')
    else history.classList.add('hidden')
  }
  if(btn) btn.setAttribute('aria-pressed', visible ? 'true' : 'false')
  if(btn) {
    try{
      // icon-only button; keep title/aria for accessibility
      btn.textContent = '📅'
    }catch(e){/* ignore */}
  }
  console.log('updateCalendarVisibility:', visible)
}

function registerServiceWorker(){
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./service-worker.js').then(reg=>{
      console.log('ServiceWorker registered', reg.scope)
    }).catch(err=> console.warn('ServiceWorker registration failed', err))
  }
}

document.addEventListener('DOMContentLoaded', init)
