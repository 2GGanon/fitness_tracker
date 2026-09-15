const assert = require('assert')
const fs = require('fs')
const vm = require('vm')

let focused = false
const select = {
  options: [{value: 'Squat'}, {value: 'Bench'}],
  selectedIndex: 0
}
const setsContainer = {
  innerHTML: 'old rows',
  querySelector(selector){
    return selector === '.set-weight' ? {focus(){ focused = true }} : null
  }
}
const elements = {sessionExerciseSelect: select, setsContainer}
const restored = []

const context = {
  console,
  restored,
  localStorage: {getItem(){ return null }, setItem(){}},
  document: {
    getElementById(id){ return elements[id] || null },
    addEventListener(){}
  },
  window: {addEventListener(){}}
}

vm.createContext(context)
vm.runInContext(fs.readFileSync('app.js', 'utf8'), context)
vm.runInContext(`
  state.currentSession = {
    entries: {
      Bench: [
        {weight: 100, unit: 'kg', reps: 5},
        {weight: 90, unit: 'kg', reps: 8}
      ]
    }
  }
  createSetRow = (...args)=>restored.push(args)
  editSessionEntry('Bench', false)
`, context)

assert.strictEqual(select.selectedIndex, 1)
assert.strictEqual(setsContainer.innerHTML, '')
assert.deepStrictEqual(JSON.parse(JSON.stringify(restored)), [
  ['setsContainer', 100, 5, 'kg'],
  ['setsContainer', 90, 8, 'kg']
])
assert.strictEqual(vm.runInContext('state.currentSession._lastEditedExercise', context), 'Bench')
assert.strictEqual(focused, false)

vm.runInContext("editSessionEntry('Bench')", context)
assert.strictEqual(focused, true)

console.log('session entry edit tests passed')
