// Forty hands and what they score. This is the file to check against.
//
// Every total here was produced by the scorer the club has used for years
// and checked against the printed tables. If your scorer disagrees with a
// line, your scorer is wrong — that is what this file is for.
//
// Cards are rank+suit, ten is T: 'AS', '5H', 'TD', 'JC'.
// `crib` marks the hands that must be scored under the crib flush rule.

const SCORED_HANDS = [
  { hand: ["5S", "5H", "5D", "JC"], cut: "5C", crib: false, total: 29,
    // the maximum: four fives and the right jack
    // fifteens: 16, pairs: 12, nobs: 1
  },
  { hand: ["5S", "5H", "5D", "5C"], cut: "JC", crib: false, total: 28,
    // four fives with the jack CUT — nobs does not apply
    // fifteens: 16, pairs: 12
  },
  { hand: ["2S", "4H", "6D", "8C"], cut: "TC", crib: false, total: 0,
    // nothing at all, the nineteen hand
    // nothing scores
  },
  { hand: ["4S", "5H", "5D", "6C"], cut: "9C", crib: false, total: 14,
    // double run of three, and a fifteen off the cut
    // fifteens: 6, pairs: 2, runs: 6
  },
  { hand: ["4S", "5H", "5D", "6H"], cut: "6C", crib: false, total: 24,
    // double double run of three
    // fifteens: 8, pairs: 4, runs: 12
  },
  { hand: ["3S", "4H", "5D", "6C"], cut: "7C", crib: false, total: 9,
    // a run of five, which does not also score its threes
    // fifteens: 4, runs: 5
  },
  { hand: ["7S", "7H", "7D", "7C"], cut: "2C", crib: false, total: 12,
    // four of a kind is twelve and no fifteens
    // pairs: 12
  },
  { hand: ["2S", "5S", "8S", "KS"], cut: "9H", crib: false, total: 8,
    // four-card flush in hand
    // fifteens: 4, flush: 4
  },
  { hand: ["2S", "5S", "8S", "KS"], cut: "9S", crib: false, total: 9,
    // five-card flush
    // fifteens: 4, flush: 5
  },
  { hand: ["2S", "5S", "8S", "KS"], cut: "9H", crib: true, total: 4,
    // the same hand as a CRIB: four is not a flush
    // fifteens: 4
  },
  { hand: ["2S", "5S", "8S", "KS"], cut: "9S", crib: true, total: 9,
    // the same crib with five: now it is
    // fifteens: 4, flush: 5
  },
  { hand: ["JS", "2H", "4D", "8C"], cut: "9S", crib: false, total: 3,
    // his nobs, and a fifteen that is easy to miss
    // fifteens: 2, nobs: 1
  },
  { hand: ["JH", "2H", "4D", "8C"], cut: "9S", crib: false, total: 2,
    // the same jack in the WRONG suit
    // fifteens: 2
  },
  { hand: ["AS", "2H", "3D", "JC"], cut: "KC", crib: false, total: 8,
    // the ace is low in a run
    // fifteens: 4, runs: 3, nobs: 1
  },
  { hand: ["JS", "QH", "KD", "AC"], cut: "2C", crib: false, total: 3,
    // and does not wrap round the top
    // runs: 3
  },
  { hand: ["TS", "JH", "QD", "KC"], cut: "9C", crib: false, total: 5,
    // court cards run
    // runs: 5
  },
  { hand: ["5S", "TH", "JD", "QC"], cut: "KC", crib: false, total: 12,
    // a run of four plus two fifteens
    // fifteens: 8, runs: 4
  },
  { hand: ["AS", "AH", "AD", "2C"], cut: "3C", crib: false, total: 15,
    // triple run of three
    // pairs: 6, runs: 9
  },
  { hand: ["6S", "7H", "8D", "9C"], cut: "TC", crib: false, total: 9,
    // run of five with a fifteen inside it
    // fifteens: 4, runs: 5
  },
  { hand: ["9S", "6H", "6D", "6C"], cut: "9H", crib: false, total: 20,
    // two pairs, one of them triple
    // fifteens: 12, pairs: 8
  },
  { hand: ["5S", "5H", "TD", "TC"], cut: "5C", crib: false, total: 22,
    // fifteens stacking with pairs
    // fifteens: 14, pairs: 8
  },
  { hand: ["4S", "4H", "7D", "7C"], cut: "AC", crib: false, total: 10,
    // two pairs and two fifteens
    // fifteens: 6, pairs: 4
  },
  { hand: ["2S", "3H", "4D", "5C"], cut: "6C", crib: false, total: 9,
    // a run of five, again, off a different base
    // fifteens: 4, runs: 5
  },
  { hand: ["8S", "7H", "7D", "6C"], cut: "9C", crib: false, total: 16,
    // double run of four
    // fifteens: 6, pairs: 2, runs: 8
  },
  { hand: ["3S", "3H", "3D", "9C"], cut: "6C", crib: false, total: 16,
    // three of a kind with fifteens
    // fifteens: 10, pairs: 6
  },
  { hand: ["AS", "2H", "3D", "4C"], cut: "5C", crib: false, total: 7,
    // ace-low run of five
    // fifteens: 2, runs: 5
  },
  { hand: ["KS", "QH", "5D", "5C"], cut: "5H", crib: false, total: 20,
    // three fives against two tens
    // fifteens: 14, pairs: 6
  },
  { hand: ["6S", "9H", "6D", "9C"], cut: "6C", crib: false, total: 20,
    // three sixes, two nines, several fifteens
    // fifteens: 12, pairs: 8
  },
  { hand: ["TS", "5H", "5D", "5C"], cut: "KC", crib: false, total: 20,
    // three fives and two court cards
    // fifteens: 14, pairs: 6
  },
  { hand: ["4S", "6H", "8D", "TC"], cut: "QC", crib: false, total: 0,
    // evens, no run, no fifteen
    // nothing scores
  },
  { hand: ["AS", "AH", "2D", "2C"], cut: "3C", crib: false, total: 16,
    // double double run of three at the bottom
    // pairs: 4, runs: 12
  },
  { hand: ["7S", "8H", "9D", "TC"], cut: "JC", crib: false, total: 7,
    // a run of five in the middle
    // fifteens: 2, runs: 5
  },
  { hand: ["2S", "2H", "2D", "9C"], cut: "9H", crib: false, total: 12,
    // three twos, two nines, fifteens both ways
    // fifteens: 4, pairs: 8
  },
  { hand: ["5S", "6H", "7D", "8C"], cut: "9C", crib: false, total: 9,
    // run of five with two fifteens
    // fifteens: 4, runs: 5
  },
  { hand: ["JS", "JH", "5D", "5C"], cut: "JD", crib: false, total: 20,
    // three jacks and two fives
    // fifteens: 12, pairs: 8
  },
  { hand: ["QS", "3H", "2D", "AC"], cut: "KC", crib: false, total: 7,
    // a run at the very top with an ace that does not join
    // fifteens: 4, runs: 3
  },
  { hand: ["4S", "4H", "4D", "4C"], cut: "7C", crib: false, total: 24,
    // four fours and a seven
    // fifteens: 12, pairs: 12
  },
  { hand: ["8S", "8H", "7D", "7C"], cut: "8C", crib: false, total: 20,
    // three eights and two sevens
    // fifteens: 12, pairs: 8
  },
  { hand: ["9S", "TH", "JD", "QC"], cut: "KC", crib: false, total: 5,
    // the top run of five
    // runs: 5
  },
  { hand: ["AS", "3H", "5D", "7C"], cut: "9C", crib: false, total: 4,
    // odds with one fifteen
    // fifteens: 4
  },
];

if (typeof module !== 'undefined') module.exports = { SCORED_HANDS };
