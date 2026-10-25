import { test } from 'node:test';
import assert from 'node:assert/strict';
import { knownFineWeight } from '../../src/lib/domain/metalWeights';

test('Feingewicht aus Produktname und bekannten Münzen', () => {
  assert.equal(knownFineWeight('Gold Sovereign'), 7.3224);
  assert.equal(knownFineWeight('Half Sovereign 2020'), 3.6612);
  assert.equal(knownFineWeight('Gold Arche Noah 1oz (2021)'), 31.1035);
  assert.equal(knownFineWeight('Krügerrand 1/10 oz'), 3.1104);
  assert.equal(knownFineWeight('Maple Leaf 1/2 Unze'), 15.5518);
  assert.equal(knownFineWeight('Vreneli 20 Franken 6,45 g'), 5.8064);
  assert.equal(knownFineWeight('20 Goldmark Wilhelm II'), 7.1685);
  assert.equal(knownFineWeight('Goldbarren 100 g Heraeus'), 100);
  assert.equal(knownFineWeight('Goldbarren 2,5 g'), 2.5);
  assert.equal(knownFineWeight('Goldschmuck Kette'), null);
});
