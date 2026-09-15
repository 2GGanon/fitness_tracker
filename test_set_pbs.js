const assert = require('assert')
const fs = require('fs')
const vm = require('vm')

const storedData = {
  exercises: [{name: 'Test exercise', overrides: {}, setPBs: []}],
  settings: {showExercises: false},
  sessions: [
    {entries: {'Test exercise': [
      {weight: 100, unit: 'kg', reps: 5},
      {weight: 60, unit: 's', reps: 1},
      {weight: 5, unit: 'km', reps: 1}
    ]}},
    {entries: {'Test exercise': [
      {weight: 225, unit: 'lbs', reps: 3},
      {weight: 0.8, unit: 'min', reps: 1},
      {weight: 4, unit: 'miles', reps: 1}
    ]}}
  ]
}

const saved = {}
const context = {
  console,
  localStorage: {
    getItem(){ return JSON.stringify(storedData) },
    setItem(key, value){ saved[key] = value }
  },
  document: {getElementById(){ return null }, addEventListener(){}},
  window: {addEventListener(){}}
}

vm.createContext(context)
vm.runInContext(fs.readFileSync('app.js', 'utf8'), context)

vm.runInContext("saveSetPB('Test exercise', 0, 225, 'lbs', 3)", context)
vm.runInContext("saveSetPB('Test exercise', 1, 0.8, 'min', 1)", context)
vm.runInContext("saveSetPB('Test exercise', 2, 4, 'miles', 1)", context)

assert.strictEqual(vm.runInContext("formatSetPB('Test exercise', 0)", context), 'PB 225lbs×3')
assert.strictEqual(vm.runInContext("formatSetPB('Test exercise', 1)", context), 'PB 0.8min×1')
assert.strictEqual(vm.runInContext("formatSetPB('Test exercise', 2)", context), 'PB 4miles×1')
assert.strictEqual(vm.runInContext("formatSetPB('Test exercise', 3)", context), 'PB —')

const persisted = JSON.parse(saved.fitness_tracker_data_v1)
assert.strictEqual(persisted.exercises[0].setPBs.length, 3)
assert.deepStrictEqual(persisted.exercises[0].setPBs.map(pb=>pb.setNumber), [1, 2, 3])

console.log('set PB tests passed')
