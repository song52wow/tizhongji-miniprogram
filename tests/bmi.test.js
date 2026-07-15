const test = require('node:test');
const assert = require('node:assert');
const { calcBmi, bmiCategory } = require('../src/utils/bmi.js');

test('calcBmi computes and rounds to one decimal', () => {
  assert.strictEqual(calcBmi(70, 175), 22.9);
  assert.strictEqual(calcBmi(60, 160), 23.4);
});

test('calcBmi returns null on missing/invalid height', () => {
  assert.strictEqual(calcBmi(70, null), null);
  assert.strictEqual(calcBmi(70, undefined), null);
  assert.strictEqual(calcBmi(70, 0), null);
  assert.strictEqual(calcBmi(70, -1), null);
});

test('calcBmi returns null on invalid weight', () => {
  assert.strictEqual(calcBmi(0, 175), null);
  assert.strictEqual(calcBmi(-5, 175), null);
  assert.strictEqual(calcBmi(NaN, 175), null);
});

test('bmiCategory China standard boundaries', () => {
  assert.strictEqual(bmiCategory(18.4).level, 'underweight');
  assert.strictEqual(bmiCategory(18.5).level, 'normal');
  assert.strictEqual(bmiCategory(23.9).level, 'normal');
  assert.strictEqual(bmiCategory(24).level, 'overweight');
  assert.strictEqual(bmiCategory(27.9).level, 'overweight');
  assert.strictEqual(bmiCategory(28).level, 'obese');
});

test('bmiCategory labels', () => {
  assert.strictEqual(bmiCategory(17).label, '偏瘦');
  assert.strictEqual(bmiCategory(22).label, '正常');
  assert.strictEqual(bmiCategory(26).label, '超重');
  assert.strictEqual(bmiCategory(30).label, '肥胖');
});

test('bmiCategory returns null on invalid input', () => {
  assert.strictEqual(bmiCategory(null), null);
  assert.strictEqual(bmiCategory(NaN), null);
});
