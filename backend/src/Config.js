module.exports = {

  pressType: 'pneumatic',
  // pressType: 'hydraulic',

  AWS: {
    accessKeyId: "AKIAJZ7IPSQG6DCPICGA",
    secretAccessKey: "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",
    region: 'us-west-2',
    // apiVersion: '2010-12-01'
    apiVersion: '2018-01-08'
  },

  minTemp: 0,
  maxTemp: 176.7, // ± 350 F
  defaultTemp: 101.667,
  minTime: 0,
  maxTime: 600,
  defaultTime: 60,
  usesFahrenheit: true,
  defaultYield: 0,
  rampingTempStart: 7,
  rampingPercentStart: 0.6,
  rampingPercentEnd: 0.35,
  materials: [
    {
      name: 'Flower',
      id: 1
    },
    {
      name: 'Grounded Flower',
      id: 2
    },
    {
      name: 'Trim',
      id: 3
    },
    {
      name: 'Bubble Hash',
      id: 4
    },
    {
      name: 'Dry Sift Hash',
      id: 5
    }
  ],
  micronBags: [
    {
      name: '25u',
      size: 25,
      id: 1
    },
    {
      name: '45u',
      size: 45,
      id: 2
    },
    {
      name: '73u',
      size: 73,
      id: 3
    },
    {
      name: '90u',
      size: 90,
      id: 4
    },
    {
      name: '120u',
      size: 120,
      id: 5
    },
    {
      name: '160u',
      size: 160,
      id: 6
    },
    {
      name: '190u',
      size: 190,
      id: 7
    },
    {
      name: '220u',
      size: 220,
      id: 8
    }
  ],

  closePress: {
    hydraulic: [
      // Initial setup before closing
      {
        relays: [0, 1],
        state: 0
      },
      // Closing
      {
        relays: [2, 3],
        state: 1
      },
      // Stop closing
      {
        relays: [2, 3],
        state: 0
      }],
    pneumatic: [
      // Initial setup before closing
      {
        relays: [],
        state: 0
      },
      // Closing
      {
        relays: [2, 3],
        state: 1
      },
      // Stop closing
      {
        relays: [],
        state: 0
      }]
  },

  openPress: {
    hydraulic: [
      // Initial setup before opening
      {
        relays: [2, 3],
        state: 0
      },
      // Opening
      {
        relays: [0, 1],
        state: 1
      },
      // Stop opening
      {
        relays: [0, 1],
        state: 0
      }],
    pneumatic: [
      // Initial setup before opening
      {
        relays: [],
        state: 0
      },
      // Opening
      {
        relays: [2, 3],
        state: 0
      },
      // Stop opening
      {
        relays: [],
        state: 0
      }]
  },
  travelTime: {
    hydraulic: 10000,
    pneumatic: 3000
  },

  emailText: 'Hi!\nWe\'re sending you your press history.',
  emailHTML: '<p>Hi!</p><p>We\'re sending you your press history.</p>',
}
