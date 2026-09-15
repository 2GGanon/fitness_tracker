const assert = require('assert')
const fs = require('fs')
const vm = require('vm')

function field(value = ''){
  return {value}
}

const elements = {
  nutritionName: field('Rice'),
  nutritionAmount: field('200'),
  nutritionUnit: field('calories'),
  nutritionSugar: field('5'),
  nutritionCaffeine: field('0.1'),
  nutritionMenuSelect: {
    value: '',
    children: [],
    appendChild(option){ this.children.push(option) }
  },
  deleteNutritionPresetBtn: {disabled: true}
}

Object.defineProperty(elements.nutritionMenuSelect, 'innerHTML', {
  set(){
    this.children = []
    this.value = ''
  }
})

const saved = {}
const context = {
  console,
  Option: function(text, value){ return {textContent: text, value} },
  alert(message){ throw new Error(message) },
  localStorage: {
    getItem(){ return null },
    setItem(key, value){ saved[key] = value }
  },
  document: {
    getElementById(id){ return elements[id] || null },
    addEventListener(){}
  },
  window: {addEventListener(){}}
}

vm.createContext(context)
vm.runInContext(fs.readFileSync('app.js', 'utf8'), context)

vm.runInContext('saveNutritionPreset()', context)
let data = JSON.parse(saved.fitness_tracker_data_v1)
assert.strictEqual(data.nutritionPresets.length, 1)
assert.strictEqual(data.nutritionPresets[0].name, 'Rice')
assert.strictEqual(elements.nutritionMenuSelect.children.length, 2)
assert.strictEqual(elements.nutritionMenuSelect.children[1].textContent, 'Rice')
assert.strictEqual(elements.deleteNutritionPresetBtn.disabled, false)

elements.nutritionName.value = ''
elements.nutritionAmount.value = ''
elements.nutritionSugar.value = ''
elements.nutritionCaffeine.value = ''
vm.runInContext('applyNutritionPreset()', context)
assert.strictEqual(elements.nutritionName.value, 'Rice')
assert.strictEqual(elements.nutritionAmount.value, 200)
assert.strictEqual(elements.nutritionSugar.value, 5)
assert.strictEqual(elements.nutritionCaffeine.value, 0.1)

elements.nutritionAmount.value = '250'
vm.runInContext('saveNutritionPreset()', context)
data = JSON.parse(saved.fitness_tracker_data_v1)
assert.strictEqual(data.nutritionPresets.length, 1)
assert.strictEqual(data.nutritionPresets[0].amount, 250)

vm.runInContext('deleteNutritionPreset()', context)
data = JSON.parse(saved.fitness_tracker_data_v1)
assert.strictEqual(data.nutritionPresets.length, 0)
assert.strictEqual(elements.nutritionMenuSelect.value, '')
assert.strictEqual(elements.deleteNutritionPresetBtn.disabled, true)

console.log('nutrition preset tests passed')
