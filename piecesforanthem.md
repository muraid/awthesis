//----------------- BLOCK 1: DeviceType + Detector + StandardDeviceConfiguration ---------------------


//----------------- In DeviceType ---------------------

enum DeviceType {
  environmentalMonitor,
  respirationMonitor,
  stressMonitor,
  polarH10,
  bangleJs,        // NEW
  unknown,
}


//--------------- In DeviceTypeExtension -----------------
// Add these cases in the respective switch statements

// displayName
case DeviceType.bangleJs:
  return 'Bangle.js 2';

// primaryColor
case DeviceType.bangleJs:
  return Colors.purple;

// icon
case DeviceType.bangleJs:
  return Icons.watch;

// description
case DeviceType.bangleJs:
  return 'Smartwatch with HRM, ACC, Gyro, Barometer, Light, Steps';

// namePrefix
case DeviceType.bangleJs:
  return 'Bangle.js';

// stringValue
case DeviceType.bangleJs:
  return 'bangle_js';

// camelCaseValue
case DeviceType.bangleJs:
  return 'bangleJs';

// fromString
static DeviceType fromString(String value) {
  switch (value.toLowerCase()) {
    case 'bangle_js':
    case 'banglejs':
    case 'bangle':
      return DeviceType.bangleJs;
    default:
      return DeviceType.unknown;
  }
}


//----------------- In DeviceTypeDetector --------------------

// Known Bangle.js UART UUIDs
static const List<String> bangleJsServiceUuids = [
  '6e400001b5a3f393e0a9e50e24dcca9e', // Nordic UART Service
  '6e400002b5a3f393e0a9e50e24dcca9e', // TX
  '6e400003b5a3f393e0a9e50e24dcca9e', // RX
];

// Name detection
static DeviceType _detectByName(String name) {
  final lower = name.toLowerCase();

  if (lower.contains('bangle') || lower.contains('espruino')) {
    return DeviceType.bangleJs;
  }

  return DeviceType.unknown;
}

// Service UUID detection
static DeviceType _detectByServices(List<String> serviceUuids) {
  int envMatches = 0;
  int respMatches = 0;
  int stressMatches = 0;
  int polarMatches = 0;
  int bangleMatches = 0;

  for (String uuid in serviceUuids) {
    final cleanUuid = uuid.replaceAll('-', '').toLowerCase();

    // Polar
    for (String polarUuid in polarH10ServiceUuids) {
      if (cleanUuid.contains(polarUuid.toLowerCase().replaceAll('-', ''))) {
        polarMatches++;
        break;
      }
    }

    // Bangle.js
    for (String bUuid in bangleJsServiceUuids) {
      if (cleanUuid.contains(bUuid)) {
        bangleMatches++;
        break;
      }
    }

    // Environmental
    for (String envUuid in environmentalMonitorServiceUuids) {
      if (cleanUuid.contains(envUuid.toLowerCase())) {
        envMatches++;
        break;
      }
    }

    // Respiration
    for (String respUuid in respirationMonitorServiceUuids) {
      if (cleanUuid.contains(respUuid.toLowerCase())) {
        respMatches++;
        break;
      }
    }

    // Stress
    for (String stressUuid in stressMonitorServiceUuids) {
      if (cleanUuid.contains(stressUuid.toLowerCase())) {
        stressMatches++;
        break;
      }
    }
  }

  // Priority: Polar → Bangle → others
  if (polarMatches > 0) return DeviceType.polarH10;
  if (bangleMatches > 0) return DeviceType.bangleJs;

  if (envMatches > 0 &&
      envMatches >= respMatches &&
      envMatches >= stressMatches) {
    return DeviceType.environmentalMonitor;
  }
  if (respMatches > 0 && respMatches >= stressMatches) {
    return DeviceType.respirationMonitor;
  }
  if (stressMatches > 0) {
    return DeviceType.stressMonitor;
  }

  return DeviceType.unknown;
}


//----------------- StandardDeviceConfiguration ------------------

// Add new field in StandardDeviceConfiguration class:
final BangleJsConfig? defaultBangleJsConfig;

// Add to constructor:
this.defaultBangleJsConfig,

// Add to configuration map:
DeviceType.bangleJs: _createBangleJsConfiguration(),

// Create Bangle.js configuration
StandardDeviceConfiguration _createBangleJsConfiguration() {
  return StandardDeviceConfiguration(
    deviceType: DeviceType.bangleJs,
    displayName: 'Bangle.js 2',
    iconKey: 'watch',
    characteristics: DeviceCharacteristics(
      serviceUuid: '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // UART
      characteristics: {
        'uart_rx': '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
        'uart_tx': '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
      },
      characteristicDescriptions: {
        'uart_rx': 'UART RX (notifications from watch)',
        'uart_tx': 'UART TX (commands to watch)',
      },
    ),

    frequencyRange: FrequencyRange(
      min: 1,
      max: 50,
      presets: [1, 5, 10, 25, 50],
      unit: 'Hz',
      description: 'Sensor sampling rate (1–50 Hz)',
      step: 1,
    ),

    dataReceptionRange: DataReceptionRange(
      minMs: 50,
      maxMs: 2000,
      presets: [50, 100, 200, 500, 1000, 2000],
      description: 'Transmission interval (50–2000 ms)',
      isMultipleOfSamplingRate: true,
    ),

    defaultEnvironmentalConfig: null,
    defaultStressConfig: null,
    defaultRespiratoryConfig: null,
    defaultPolarH10Config: null,

    defaultBangleJsConfig: BangleJsConfig(
      samplingFrequency: 25,
      transmissionInterval: 200,
      hrmEnabled: true,
      accelEnabled: true,
      gyroEnabled: false,
      barometerEnabled: false,
      lightEnabled: false,
      stepsEnabled: false,
      magnetometerEnabled: false,
    ),
  );
}


//----------------- BLOCK 2: BangleJsConfig + UnifiedDeviceConfiguration + BluetoothDeviceInfo ------------------


//----------------- bangle_js_config.dart ------------------

class BangleJsConfig {
  final int samplingFrequency;       // Hz
  final int transmissionInterval;    // ms

  final bool hrmEnabled;
  final bool accelEnabled;
  final bool gyroEnabled;
  final bool barometerEnabled;
  final bool lightEnabled;
  final bool stepsEnabled;
  final bool magnetometerEnabled;

  const BangleJsConfig({
    required this.samplingFrequency,
    required this.transmissionInterval,
    required this.hrmEnabled,
    required this.accelEnabled,
    required this.gyroEnabled,
    required this.barometerEnabled,
    required this.lightEnabled,
    required this.stepsEnabled,
    required this.magnetometerEnabled,
  });

  Map<String, dynamic> toJson() => {
        'samplingFrequency': samplingFrequency,
        'transmissionInterval': transmissionInterval,
        'hrmEnabled': hrmEnabled,
        'accelEnabled': accelEnabled,
        'gyroEnabled': gyroEnabled,
        'barometerEnabled': barometerEnabled,
        'lightEnabled': lightEnabled,
        'stepsEnabled': stepsEnabled,
        'magnetometerEnabled': magnetometerEnabled,
      };

  factory BangleJsConfig.fromJson(Map<String, dynamic> json) {
    return BangleJsConfig(
      samplingFrequency: json['samplingFrequency'] ?? 25,
      transmissionInterval: json['transmissionInterval'] ?? 200,
      hrmEnabled: json['hrmEnabled'] ?? true,
      accelEnabled: json['accelEnabled'] ?? true,
      gyroEnabled: json['gyroEnabled'] ?? false,
      barometerEnabled: json['barometerEnabled'] ?? false,
      lightEnabled: json['lightEnabled'] ?? false,
      stepsEnabled: json['stepsEnabled'] ?? false,
      magnetometerEnabled: json['magnetometerEnabled'] ?? false,
    );
  }
}


//----------------- unified_device_configuration.dart ------------------

// Add new property
final BangleJsConfig? bangleJsConfig;

// Add to constructor
this.bangleJsConfig,

// Add to copyWith
bangleJsConfig: bangleJsConfig ?? this.bangleJsConfig,

// Add to toJson
'bangleJsConfig': bangleJsConfig?.toJson(),

// Add to fromJson
bangleJsConfig: json['bangleJsConfig'] != null
    ? BangleJsConfig.fromJson(json['bangleJsConfig'])
    : null,


//----------------- BluetoothDeviceInfo ------------------

// In fromBluetoothDevice
BangleJsConfig? bangleConfig;

if (deviceType == DeviceType.bangleJs) {
  bangleConfig = BangleJsConfig(
    samplingFrequency: 25,
    transmissionInterval: 200,
    hrmEnabled: true,
    accelEnabled: true,
    gyroEnabled: false,
    barometerEnabled: false,
    lightEnabled: false,
    stepsEnabled: false,
    magnetometerEnabled: false,
  );
}

// In defaultConfig
if (deviceType == DeviceType.bangleJs) {
  defaultConfig = UnifiedDeviceConfiguration(
    deviceId: id,
    deviceName: name,
    deviceType: 'bangle_js',
    lastConfigured: DateTime.now(),
    bangleJsConfig: bangleConfig,
  );
}

// In fromJson
BangleJsConfig? bangleConfigFromJson;

if (json['bangleJsConfig'] != null) {
  bangleConfigFromJson = BangleJsConfig.fromJson(json['bangleJsConfig']);
}

// In return
configuration: configuration?.copyWith(
  bangleJsConfig: bangleConfigFromJson,
),

// In toJson
'bangleJsConfig': configuration?.bangleJsConfig?.toJson(),


//----------------- BLOCK 3: BangleData + BangleDataNotifier ------------------


//----------------- bangle_data.dart ------------------

class BangleData {
  final int? hr;
  final double? ax;
  final double? ay;
  final double? az;
  final double? gx;
  final double? gy;
  final double? gz;
  final double? pressure;
  final double? light;
  final int? steps;
  final double? magX;
  final double? magY;
  final double? magZ;

  const BangleData({
    this.hr,
    this.ax,
    this.ay,
    this.az,
    this.gx,
    this.gy,
    this.gz,
    this.pressure,
    this.light,
    this.steps,
    this.magX,
    this.magY,
    this.magZ,
  });

  BangleData copyWith({
    int? hr,
    double? ax,
    double? ay,
    double? az,
    double? gx,
    double? gy,
    double? gz,
    double? pressure,
    double? light,
    int? steps,
    double? magX,
    double? magY,
    double? magZ,
  }) {
    return BangleData(
      hr: hr ?? this.hr,
      ax: ax ?? this.ax,
      ay: ay ?? this.ay,
      az: az ?? this.az,
      gx: gx ?? this.gx,
      gy: gy ?? this.gy,
      gz: gz ?? this.gz,
      pressure: pressure ?? this.pressure,
      light: light ?? this.light,
      steps: steps ?? this.steps,
      magX: magX ?? this.magX,
      magY: magY ?? this.magY,
      magZ: magZ ?? this.magZ,
    );
  }
}


//----------------- bangle_data_notifier.dart ------------------

import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:unified_ble/unified_ble.dart';

class BangleDataNotifier extends StateNotifier<BangleData> {
  BangleDataNotifier() : super(const BangleData());

  final UnifiedBleManager _ble = UnifiedBleManager.instance;

  static const String UART_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
  static const String UART_RX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
  static const String UART_TX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

  // Subscribe to UART notifications
  Future<void> subscribe(String deviceId) async {
    await _ble.subscribeToCharacteristic(
      deviceId,
      Guid(UART_SERVICE),
      Guid(UART_RX),
      (data) {
        final text = utf8.decode(data);
        _handleIncoming(text.trim());
      },
    );
  }

  // Send command to watch
  Future<void> send(String deviceId, String cmd) async {
    await _ble.writeToCharacteristic(
      deviceId,
      Guid(UART_SERVICE),
      Guid(UART_TX),
      utf8.encode(cmd + "\n"),
      false,
    );
  }

  // Apply configuration to watch
  Future<void> applyConfig(
    String deviceId,
    UnifiedDeviceConfiguration config,
  ) async {
    final c = config.bangleJsConfig;
    if (c == null) return;

    await send(deviceId, "SET_SAMPLING ${c.samplingFrequency}");
    await send(deviceId, "SET_INTERVAL ${c.transmissionInterval}");

    if (c.hrmEnabled) await send(deviceId, "ENABLE HRM");
    if (c.accelEnabled) await send(deviceId, "ENABLE ACC");
    if (c.gyroEnabled) await send(deviceId, "ENABLE GYRO");
    if (c.barometerEnabled) await send(deviceId, "ENABLE BARO");
    if (c.lightEnabled) await send(deviceId, "ENABLE LIGHT");
    if (c.stepsEnabled) await send(deviceId, "ENABLE STEPS");
    if (c.magnetometerEnabled) await send(deviceId, "ENABLE MAG");

    if (!c.hrmEnabled) await send(deviceId, "DISABLE HRM");
    if (!c.accelEnabled) await send(deviceId, "DISABLE ACC");
    if (!c.gyroEnabled) await send(deviceId, "DISABLE GYRO");
    if (!c.barometerEnabled) await send(deviceId, "DISABLE BARO");
    if (!c.lightEnabled) await send(deviceId, "DISABLE LIGHT");
    if (!c.stepsEnabled) await send(deviceId, "DISABLE STEPS");
    if (!c.magnetometerEnabled) await send(deviceId, "DISABLE MAG");
  }

  // Start measurement
  Future<void> start(String deviceId) async {
    await send(deviceId, "START");
  }

  // Stop measurement
  Future<void> stop(String deviceId) async {
    await send(deviceId, "STOP");
  }

  // Parse incoming UART messages
  void _handleIncoming(String text) {
    if (text.startsWith("HRM:")) {
      _parseHrm(text.substring(4));
    } else if (text.startsWith("ACC:")) {
      _parseAcc(text.substring(4));
    } else if (text.startsWith("GYRO:")) {
      _parseGyro(text.substring(5));
    } else if (text.startsWith("BARO:")) {
      _parseBaro(text.substring(5));
    } else if (text.startsWith("LIGHT:")) {
      _parseLight(text.substring(6));
    } else if (text.startsWith("STEPS:")) {
      _parseSteps(text.substring(6));
    } else if (text.startsWith("MAG:")) {
      _parseMag(text.substring(4));
    }
  }

  void _parseHrm(String jsonStr) {
    try {
      final j = jsonDecode(jsonStr);
      state = state.copyWith(hr: j["bpm"]);
    } catch (_) {}
  }

  void _parseAcc(String jsonStr) {
    try {
      final j = jsonDecode(jsonStr);
      state = state.copyWith(
        ax: (j["x"] ?? 0).toDouble(),
        ay: (j["y"] ?? 0).toDouble(),
        az: (j["z"] ?? 0).toDouble(),
      );
    } catch (_) {}
  }

  void _parseGyro(String jsonStr) {
    try {
      final j = jsonDecode(jsonStr);
      state = state.copyWith(
        gx: (j["x"] ?? 0).toDouble(),
        gy: (j["y"] ?? 0).toDouble(),
        gz: (j["z"] ?? 0).toDouble(),
      );
    } catch (_) {}
  }

  void _parseBaro(String jsonStr) {
    try {
      final j = jsonDecode(jsonStr);
      state = state.copyWith(
        pressure: (j["pressure"] ?? 0).toDouble(),
      );
    } catch (_) {}
  }

  void _parseLight(String jsonStr) {
    try {
      final j = jsonDecode(jsonStr);
      state = state.copyWith(
        light: (j["light"] ?? 0).toDouble(),
      );
    } catch (_) {}
  }

  void _parseSteps(String jsonStr) {
    try {
      final j = jsonDecode(jsonStr);
      state = state.copyWith(
        steps: j["steps"],
      );
    } catch (_) {}
  }

  void _parseMag(String jsonStr) {
    try {
      final j = jsonDecode(jsonStr);
      state = state.copyWith(
        magX: (j["x"] ?? 0).toDouble(),
        magY: (j["y"] ?? 0).toDouble(),
        magZ: (j["z"] ?? 0).toDouble(),
      );
    } catch (_) {}
  }
}


//----------------- BLOCK 4: UI – sliders + toggles ------------------

// This is a UI building block for configuring Bangle.js settings.
// It is intentionally simple so the next developer can integrate it easily.

class BangleConfigurationScreen extends StatelessWidget {
  final BluetoothDeviceInfo deviceInfo;
  final UnifiedDeviceConfiguration config;
  final void Function(UnifiedDeviceConfiguration) onConfig// ==========================================================
//  BANGLE.JS 2 – FULL INTEGRATION (BLOCK 1–5)
//  Structure inspired by Aida's compilation
//  All comments translated to English
// ==========================================================


//----------------- BLOCK 1: DeviceType + Detector + StandardDeviceConfiguration ---------------------


//----------------- In DeviceType ---------------------

enum DeviceType {
  environmentalMonitor,
  respirationMonitor,
  stressMonitor,
  polarH10,
  bangleJs,        // NEW
  unknown,
}


//--------------- In DeviceTypeExtension -----------------
// Add these cases in the respective switch statements

// displayName
case DeviceType.bangleJs:
  return 'Bangle.js 2';

// primaryColor
case DeviceType.bangleJs:
  return Colors.purple;

// icon
case DeviceType.bangleJs:
  return Icons.watch;

// description
case DeviceType.bangleJs:
  return 'Smartwatch with HRM, ACC, Gyro, Barometer, Light, Steps';

// namePrefix
case DeviceType.bangleJs:
  return 'Bangle.js';

// stringValue
case DeviceType.bangleJs:
  return 'bangle_js';

// camelCaseValue
case DeviceType.bangleJs:
  return 'bangleJs';

// fromString
static DeviceType fromString(String value) {
  switch (value.toLowerCase()) {
    case 'bangle_js':
    case 'banglejs':
    case 'bangle':
      return DeviceType.bangleJs;
    default:
      return DeviceType.unknown;
  }
}


//----------------- In DeviceTypeDetector --------------------

// Known Bangle.js UART UUIDs
static const List<String> bangleJsServiceUuids = [
  '6e400001b5a3f393e0a9e50e24dcca9e', // Nordic UART Service
  '6e400002b5a3f393e0a9e50e24dcca9e', // TX
  '6e400003b5a3f393e0a9e50e24dcca9e', // RX
];

// Name detection
static DeviceType _detectByName(String name) {
  final lower = name.toLowerCase();

  if (lower.contains('bangle') || lower.contains('espruino')) {
    return DeviceType.bangleJs;
  }

  return DeviceType.unknown;
}

// Service UUID detection
static DeviceType _detectByServices(List<String> serviceUuids) {
  int envMatches = 0;
  int respMatches = 0;
  int stressMatches = 0;
  int polarMatches = 0;
  int bangleMatches = 0;

  for (String uuid in serviceUuids) {
    final cleanUuid = uuid.replaceAll('-', '').toLowerCase();

    // Polar
    for (String polarUuid in polarH10ServiceUuids) {
      if (cleanUuid.contains(polarUuid.toLowerCase().replaceAll('-', ''))) {
        polarMatches++;
        break;
      }
    }

    // Bangle.js
    for (String bUuid in bangleJsServiceUuids) {
      if (cleanUuid.contains(bUuid)) {
        bangleMatches++;
        break;
      }
    }

    // Environmental
    for (String envUuid in environmentalMonitorServiceUuids) {
      if (cleanUuid.contains(envUuid.toLowerCase())) {
        envMatches++;
        break;
      }
    }

    // Respiration
    for (String respUuid in respirationMonitorServiceUuids) {
      if (cleanUuid.contains(respUuid.toLowerCase())) {
        respMatches++;
        break;
      }
    }

    // Stress
    for (String stressUuid in stressMonitorServiceUuids) {
      if (cleanUuid.contains(stressUuid.toLowerCase())) {
        stressMatches++;
        break;
      }
    }
  }

  // Priority: Polar → Bangle → others
  if (polarMatches > 0) return DeviceType.polarH10;
  if (bangleMatches > 0) return DeviceType.bangleJs;

  if (envMatches > 0 &&
      envMatches >= respMatches &&
      envMatches >= stressMatches) {
    return DeviceType.environmentalMonitor;
  }
  if (respMatches > 0 && respMatches >= stressMatches) {
    return DeviceType.respirationMonitor;
  }
  if (stressMatches > 0) {
    return DeviceType.stressMonitor;
  }

  return DeviceType.unknown;
}


//----------------- StandardDeviceConfiguration ------------------

// Add new field in StandardDeviceConfiguration class:
final BangleJsConfig? defaultBangleJsConfig;

// Add to constructor:
this.defaultBangleJsConfig,

// Add to configuration map:
DeviceType.bangleJs: _createBangleJsConfiguration(),

// Create Bangle.js configuration
StandardDeviceConfiguration _createBangleJsConfiguration() {
  return StandardDeviceConfiguration(
    deviceType: DeviceType.bangleJs,
    displayName: 'Bangle.js 2',
    iconKey: 'watch',
    characteristics: DeviceCharacteristics(
      serviceUuid: '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // UART
      characteristics: {
        'uart_rx': '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
        'uart_tx': '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
      },
      characteristicDescriptions: {
        'uart_rx': 'UART RX (notifications from watch)',
        'uart_tx': 'UART TX (commands to watch)',
      },
    ),

    frequencyRange: FrequencyRange(
      min: 1,
      max: 50,
      presets: [1, 5, 10, 25, 50],
      unit: 'Hz',
      description: 'Sensor sampling rate (1–50 Hz)',
      step: 1,
    ),

    dataReceptionRange: DataReceptionRange(
      minMs: 50,
      maxMs: 2000,
      presets: [50, 100, 200, 500, 1000, 2000],
      description: 'Transmission interval (50–2000 ms)',
      isMultipleOfSamplingRate: true,
    ),

    defaultEnvironmentalConfig: null,
    defaultStressConfig: null,
    defaultRespiratoryConfig: null,
    defaultPolarH10Config: null,

    defaultBangleJsConfig: BangleJsConfig(
      samplingFrequency: 25,
      transmissionInterval: 200,
      hrmEnabled: true,
      accelEnabled: true,
      gyroEnabled: false,
      barometerEnabled: false,
      lightEnabled: false,
      stepsEnabled: false,
      magnetometerEnabled: false,
    ),
  );
}


//----------------- BLOCK 2: BangleJsConfig + UnifiedDeviceConfiguration + BluetoothDeviceInfo ------------------


//----------------- bangle_js_config.dart ------------------

class BangleJsConfig {
  final int samplingFrequency;       // Hz
  final int transmissionInterval;    // ms

  final bool hrmEnabled;
  final bool accelEnabled;
  final bool gyroEnabled;
  final bool barometerEnabled;
  final bool lightEnabled;
  final bool stepsEnabled;
  final bool magnetometerEnabled;

  const BangleJsConfig({
    required this.samplingFrequency,
    required this.transmissionInterval,
    required this.hrmEnabled,
    required this.accelEnabled,
    required this.gyroEnabled,
    required this.barometerEnabled,
    required this.lightEnabled,
    required this.stepsEnabled,
    required this.magnetometerEnabled,
  });

  Map<String, dynamic> toJson() => {
        'samplingFrequency': samplingFrequency,
        'transmissionInterval': transmissionInterval,
        'hrmEnabled': hrmEnabled,
        'accelEnabled': accelEnabled,
        'gyroEnabled': gyroEnabled,
        'barometerEnabled': barometerEnabled,
        'lightEnabled': lightEnabled,
        'stepsEnabled': stepsEnabled,
        'magnetometerEnabled': magnetometerEnabled,
      };

  factory BangleJsConfig.fromJson(Map<String, dynamic> json) {
    return BangleJsConfig(
      samplingFrequency: json['samplingFrequency'] ?? 25,
      transmissionInterval: json['transmissionInterval'] ?? 200,
      hrmEnabled: json['hrmEnabled'] ?? true,
      accelEnabled: json['accelEnabled'] ?? true,
      gyroEnabled: json['gyroEnabled'] ?? false,
      barometerEnabled: json['barometerEnabled'] ?? false,
      lightEnabled: json['lightEnabled'] ?? false,
      stepsEnabled: json['stepsEnabled'] ?? false,
      magnetometerEnabled: json['magnetometerEnabled'] ?? false,
    );
  }
}


//----------------- unified_device_configuration.dart ------------------

// Add new property
final BangleJsConfig? bangleJsConfig;

// Add to constructor
this.bangleJsConfig,

// Add to copyWith
bangleJsConfig: bangleJsConfig ?? this.bangleJsConfig,

// Add to toJson
'bangleJsConfig': bangleJsConfig?.toJson(),

// Add to fromJson
bangleJsConfig: json['bangleJsConfig'] != null
    ? BangleJsConfig.fromJson(json['bangleJsConfig'])
    : null,


//----------------- BluetoothDeviceInfo ------------------

// In fromBluetoothDevice
BangleJsConfig? bangleConfig;

if (deviceType == DeviceType.bangleJs) {
  bangleConfig = BangleJsConfig(
    samplingFrequency: 25,
    transmissionInterval: 200,
    hrmEnabled: true,
    accelEnabled: true,
    gyroEnabled: false,
    barometerEnabled: false,
    lightEnabled: false,
    stepsEnabled: false,
    magnetometerEnabled: false,
  );
}

// In defaultConfig
if (deviceType == DeviceType.bangleJs) {
  defaultConfig = UnifiedDeviceConfiguration(
    deviceId: id,
    deviceName: name,
    deviceType: 'bangle_js',
    lastConfigured: DateTime.now(),
    bangleJsConfig: bangleConfig,
  );
}

// In fromJson
BangleJsConfig? bangleConfigFromJson;

if (json['bangleJsConfig'] != null) {
  bangleConfigFromJson = BangleJsConfig.fromJson(json['bangleJsConfig']);
}

// In return
configuration: configuration?.copyWith(
  bangleJsConfig: bangleConfigFromJson,
),

// In toJson
'bangleJsConfig': configuration?.bangleJsConfig?.toJson(),


//----------------- BLOCK 3: BangleData + BangleDataNotifier ------------------


//----------------- bangle_data.dart ------------------

class BangleData {
  final int? hr;
  final double? ax;
  final double? ay;
  final double? az;
  final double? gx;
  final double? gy;
  final double? gz;
  final double? pressure;
  final double? light;
  final int? steps;
  final double? magX;
  final double? magY;
  final double? magZ;

  const BangleData({
    this.hr,
    this.ax,
    this.ay,
    this.az,
    this.gx,
    this.gy,
    this.gz,
    this.pressure,
    this.light,
    this.steps,
    this.magX,
    this.magY,
    this.magZ,
  });

  BangleData copyWith({
    int? hr,
    double? ax,
    double? ay,
    double? az,
    double? gx,
    double? gy,
    double? gz,
    double? pressure,
    double? light,
    int? steps,
    double? magX,
    double? magY,
    double? magZ,
  }) {
    return BangleData(
      hr: hr ?? this.hr,
      ax: ax ?? this.ax,
      ay: ay ?? this.ay,
      az: az ?? this.az,
      gx: gx ?? this.gx,
      gy: gy ?? this.gy,
      gz: gz ?? this.gz,
      pressure: pressure ?? this.pressure,
      light: light ?? this.light,
      steps: steps ?? this.steps,
      magX: magX ?? this.magX,
      magY: magY ?? this.magY,
      magZ: magZ ?? this.magZ,
    );
  }
}


//----------------- bangle_data_notifier.dart ------------------

import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:unified_ble/unified_ble.dart';

class BangleDataNotifier extends StateNotifier<BangleData> {
  BangleDataNotifier() : super(const BangleData());

  final UnifiedBleManager _ble = UnifiedBleManager.instance;

  static const String UART_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
  static const String UART_RX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
  static const String UART_TX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

  // Subscribe to UART notifications
  Future<void> subscribe(String deviceId) async {
    await _ble.subscribeToCharacteristic(
      deviceId,
      Guid(UART_SERVICE),
      Guid(UART_RX),
      (data) {
        final text = utf8.decode(data);
        _handleIncoming(text.trim());
      },
    );
  }

  // Send command to watch
  Future<void> send(String deviceId, String cmd) async {
    await _ble.writeToCharacteristic(
      deviceId,
      Guid(UART_SERVICE),
      Guid(UART_TX),
      utf8.encode(cmd + "\n"),
      false,
    );
  }

  // Apply configuration to watch
  Future<void> applyConfig(
    String deviceId,
    UnifiedDeviceConfiguration config,
  ) async {
    final c = config.bangleJsConfig;
    if (c == null) return;

    await send(deviceId, "SET_SAMPLING ${c.samplingFrequency}");
    await send(deviceId, "SET_INTERVAL ${c.transmissionInterval}");

    if (c.hrmEnabled) await send(deviceId, "ENABLE HRM");
    if (c.accelEnabled) await send(deviceId, "ENABLE ACC");
    if (c.gyroEnabled) await send(deviceId, "ENABLE GYRO");
    if (c.barometerEnabled) await send(deviceId, "ENABLE BARO");
    if (c.lightEnabled) await send(deviceId, "ENABLE LIGHT");
    if (c.stepsEnabled) await send(deviceId, "ENABLE STEPS");
    if (c.magnetometerEnabled) await send(deviceId, "ENABLE MAG");

    if (!c.hrmEnabled) await send(deviceId, "DISABLE HRM");
    if (!c.accelEnabled) await send(deviceId, "DISABLE ACC");
    if (!c.gyroEnabled) await send(deviceId, "DISABLE GYRO");
    if (!c.barometerEnabled) await send(deviceId, "DISABLE BARO");
    if (!c.lightEnabled) await send(deviceId, "DISABLE LIGHT");
    if (!c.stepsEnabled) await send(deviceId, "DISABLE STEPS");
    if (!c.magnetometerEnabled) await send(deviceId, "DISABLE MAG");
  }

  // Start measurement
  Future<void> start(String deviceId) async {
    await send(deviceId, "START");
  }

  // Stop measurement
  Future<void> stop(String deviceId) async {
    await send(deviceId, "STOP");
  }

  // Parse incoming UART messages
  void _handleIncoming(String text) {
    if (text.startsWith("HRM:")) {
      _parseHrm(text.substring(4));
    } else if (text.startsWith("ACC:")) {
      _parseAcc(text.substring(4));
    } else if (text.startsWith("GYRO:")) {
      _parseGyro(text.substring(5));
    } else if (text.startsWith("BARO:")) {
      _parseBaro(text.substring(5));
    } else if (text.startsWith("LIGHT:")) {
      _parseLight(text.substring(6));
    } else if (text.startsWith("STEPS:")) {
      _parseSteps(text.substring(6));
    } else if (text.startsWith("MAG:")) {
      _parseMag(text.substring(4));
    }
  }

  void _parseHrm(String jsonStr) {
    try {
      final j = jsonDecode(jsonStr);
      state = state.copyWith(hr: j["bpm"]);
    } catch (_) {}
  }

  void _parseAcc(String jsonStr) {
    try {
      final j = jsonDecode(jsonStr);
      state = state.copyWith(
        ax: (j["x"] ?? 0).toDouble(),
        ay: (j["y"] ?? 0).toDouble(),
        az: (j["z"] ?? 0).toDouble(),
      );
    } catch (_) {}
  }

  void _parseGyro(String jsonStr) {
    try {
      final j = jsonDecode(jsonStr);
      state = state.copyWith(
        gx: (j["x"] ?? 0).toDouble(),
        gy: (j["y"] ?? 0).toDouble(),
        gz: (j["z"] ?? 0).toDouble(),
      );
    } catch (_) {}
  }

  void _parseBaro(String jsonStr) {
    try {
      final j = jsonDecode(jsonStr);
      state = state.copyWith(
        pressure: (j["pressure"] ?? 0).toDouble(),
      );
    } catch (_) {}
  }

  void _parseLight(String jsonStr) {
    try {
      final j = jsonDecode(jsonStr);
      state = state.copyWith(
        light: (j["light"] ?? 0).toDouble(),
      );
    } catch (_) {}
  }

  void _parseSteps(String jsonStr) {
    try {
      final j = jsonDecode(jsonStr);
      state = state.copyWith(
        steps: j["steps"],
      );
    } catch (_) {}
  }

  void _parseMag(String jsonStr) {
    try {
      final j = jsonDecode(jsonStr);
      state = state.copyWith(
        magX: (j["x"] ?? 0).toDouble(),
        magY: (j["y"] ?? 0).toDouble(),
        magZ: (j["z"] ?? 0).toDouble(),
      );
    } catch (_) {}
  }
}


//----------------- BLOCK 4: UI – sliders + toggles ------------------

// This is a UI building block for configuring Bangle.js settings.
// It is intentionally simple so the next developer can integrate it easily.

class BangleConfigurationScreen extends StatelessWidget {
  final BluetoothDeviceInfo deviceInfo;
  final UnifiedDeviceConfiguration config;
  final void Function(UnifiedDeviceConfiguration) onConfig