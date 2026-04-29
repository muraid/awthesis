// ==========================================================
//  BANGLE.JS 2 – FULL INTEGRATION (BLOCK 1–5)
//  Struktur inspirerad av Aidas sammanställning
// ==========================================================


//----------------- BLOCK 1: DeviceType + Detector + StandardDeviceConfiguration ---------------------


//----------------- In DeviceType ---------------------

enum DeviceType {
  environmentalMonitor,
  respirationMonitor,
  stressMonitor,
  polarH10,
  bangleJs,        // 👈 NY
  unknown,
}


//--------------- In DeviceTypeExtension -----------------
// Lägg till dessa case i respektive switch

// displayName
// ...
// case DeviceType.environmentalMonitor: ...
// case DeviceType.respirationMonitor: ...
// case DeviceType.stressMonitor: ...
// case DeviceType.polarH10: ...
case DeviceType.bangleJs:
  return 'Bangle.js 2';
// case DeviceType.unknown: ...

// primaryColor
// ...
case DeviceType.bangleJs:
  return Colors.purple;

// icon
// ...
case DeviceType.bangleJs:
  return Icons.watch;

// description
// ...
case DeviceType.bangleJs:
  return 'Smartwatch with HRM, ACC, Gyro, Barometer, Light, Steps';

// namePrefix
// ...
case DeviceType.bangleJs:
  return 'Bangle.js';

// stringValue
// ...
case DeviceType.bangleJs:
  return 'bangle_js';

// camelCaseValue
// ...
case DeviceType.bangleJs:
  return 'bangleJs';

// in fromString
static DeviceType fromString(String value) {
  switch (value.toLowerCase()) {
    // ...
    case 'bangle_js':
    case 'banglejs':
    case 'bangle':
      return DeviceType.bangleJs;
    default:
      return DeviceType.unknown;
  }
}


//----------------- In DeviceTypeDetector --------------------

// Known Bangle UUIDs
static const List<String> bangleJsServiceUuids = [
  '6e400001b5a3f393e0a9e50e24dcca9e', // Nordic UART Service
  '6e400002b5a3f393e0a9e50e24dcca9e', // TX
  '6e400003b5a3f393e0a9e50e24dcca9e', // RX
];

// in _detectByName
static DeviceType _detectByName(String name) {
  final lower = name.toLowerCase();

  // ... befintliga mönster

  if (lower.contains('bangle') || lower.contains('espruino')) {
    return DeviceType.bangleJs;
  }

  return DeviceType.unknown;
}

// in _detectByServices
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

    // Bangle
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

  // Prioritet: Polar → Bangle → resten
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

// I StandardDeviceConfiguration-klassen:
class StandardDeviceConfiguration {
  final DeviceType deviceType;
  final String displayName;
  final String iconKey;
  final DeviceCharacteristics characteristics;
  final FrequencyRange frequencyRange;
  final DataReceptionRange? dataReceptionRange;

  final EnvironmentalConfig? defaultEnvironmentalConfig;
  final StressMonitorConfig? defaultStressConfig;
  final RespiratoryConfig? defaultRespiratoryConfig;
  final PolarH10Config? defaultPolarH10Config;

  // 👇 NY
  final BangleJsConfig? defaultBangleJsConfig;

  const StandardDeviceConfiguration({
    required this.deviceType,
    required this.displayName,
    required this.iconKey,
    required this.characteristics,
    required this.frequencyRange,
    this.dataReceptionRange,
    this.defaultEnvironmentalConfig,
    this.defaultStressConfig,
    this.defaultRespiratoryConfig,
    this.defaultPolarH10Config,
    this.defaultBangleJsConfig,
  });
}

// In _initializeConfigurations()
_configurations = {
  DeviceType.environmentalMonitor: _createEnvironmentalConfiguration(),
  DeviceType.stressMonitor: _createStressConfiguration(),
  DeviceType.respirationMonitor: _createRespiratoryConfiguration(),
  DeviceType.polarH10: _createPolarH10Configuration(),
  DeviceType.bangleJs: _createBangleJsConfiguration(), // 👈 NY
  DeviceType.unknown: _createUnknownConfiguration(),
};

// Create this function 
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

    // Sampling frequency slider (1–50 Hz)
    frequencyRange: FrequencyRange(
      min: 1,
      max: 50,
      presets: [1, 5, 10, 25, 50],
      unit: 'Hz',
      description: 'Sensor sampling rate (1–50 Hz)',
      step: 1,
    ),

    // Data transmission interval slider (50–2000 ms)
    dataReceptionRange: DataReceptionRange(
      minMs: 50,
      maxMs: 2000,
      presets: [50, 100, 200, 500, 1000, 2000],
      description: 'Transmission interval (50–2000 ms)',
      isMultipleOfSamplingRate: true,
    ),

    // Default sensor configuration
    defaultEnvironmentalConfig: null,
    defaultStressConfig: null,
    defaultRespiratoryConfig: null,
    defaultPolarH10Config: null,

    // 👇 NY: default Bangle config
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


//----------------- Create file bangle_js_config.dart ------------------
// put in same folder as environmental_config.dart etc.

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

  // JSON serialization
  Map<String, dynamic> toJson() {
    return {
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
  }

  // JSON deserialization
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


//----------------- In unified_device_configuration.dart ------------------

// new property
final BangleJsConfig? bangleJsConfig;

// in constructor
const UnifiedDeviceConfiguration({
  required this.deviceId,
  required this.deviceName,
  required this.deviceType,
  this.lastConfigured,
  this.environmentalConfig,
  this.stressMonitorConfig,
  this.respiratoryConfig,
  this.polarH10Config,
  this.bangleJsConfig, // 👈 NY
});

// add copyWith 
UnifiedDeviceConfiguration copyWith({
  String? deviceId,
  String? deviceName,
  String? deviceType,
  DateTime? lastConfigured,
  EnvironmentalConfig? environmentalConfig,
  StressMonitorConfig? stressMonitorConfig,
  RespiratoryConfig? respiratoryConfig,
  PolarH10Config? polarH10Config,
  BangleJsConfig? bangleJsConfig,
}) {
  return UnifiedDeviceConfiguration(
    deviceId: deviceId ?? this.deviceId,
    deviceName: deviceName ?? this.deviceName,
    deviceType: deviceType ?? this.deviceType,
    lastConfigured: lastConfigured ?? this.lastConfigured,
    environmentalConfig: environmentalConfig ?? this.environmentalConfig,
    stressMonitorConfig: stressMonitorConfig ?? this.stressMonitorConfig,
    respiratoryConfig: respiratoryConfig ?? this.respiratoryConfig,
    polarH10Config: polarH10Config ?? this.polarH10Config,
    bangleJsConfig: bangleJsConfig ?? this.bangleJsConfig,
  );
}

// add in toJson
Map<String, dynamic> toJson() {
  return {
    'deviceId': deviceId,
    'deviceName': deviceName,
    'deviceType': deviceType,
    'lastConfigured': lastConfigured?.millisecondsSinceEpoch,
    'environmentalConfig': environmentalConfig?.toJson(),
    'stressMonitorConfig': stressMonitorConfig?.toJson(),
    'respiratoryConfig': respiratoryConfig?.toJson(),
    'polarH10Config': polarH10Config?.toJson(),
    'bangleJsConfig': bangleJsConfig?.toJson(), // 👈 NY
  };
}

// add in fromJson
factory UnifiedDeviceConfiguration.fromJson(Map<String, dynamic> json) {
  return UnifiedDeviceConfiguration(
    deviceId: json['deviceId'],
    deviceName: json['deviceName'],
    deviceType: json['deviceType'],
    lastConfigured:
        json['lastConfigured'] != null
            ? DateTime.fromMillisecondsSinceEpoch(json['lastConfigured'])
            : null,
    environmentalConfig:
        json['environmentalConfig'] != null
            ? EnvironmentalConfig.fromJson(json['environmentalConfig'])
            : null,
    stressMonitorConfig:
        json['stressMonitorConfig'] != null
            ? StressMonitorConfig.fromJson(json['stressMonitorConfig'])
            : null,
    respiratoryConfig:
        json['respiratoryConfig'] != null
            ? RespiratoryConfig.fromJson(json['respiratoryConfig'])
            : null,
    polarH10Config:
        json['polarH10Config'] != null
            ? PolarH10Config.fromJson(json['polarH10Config'])
            : null,
    bangleJsConfig:
        json['bangleJsConfig'] != null
            ? BangleJsConfig.fromJson(json['bangleJsConfig'])
            : null,
  );
}


//----------------- In BluetoothDeviceInfo ------------------

// in fromBluetoothDevice, after "final deviceType"
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
UnifiedDeviceConfiguration? defaultConfig;
if (deviceType != DeviceType.unknown) {
  final deviceTypeString = deviceType.toString().split('.').last;

  defaultConfig = UnifiedDeviceConfiguration(
    deviceId: id,
    deviceName: name,
    deviceType: deviceTypeString,
    lastConfigured: DateTime.now(),
    bangleJsConfig: bangleConfig, // null för andra typer
  );
}

// in fromJson
BangleJsConfig? bangleConfigFromJson;
if (json['bangleJsConfig'] != null) {
  bangleConfigFromJson = BangleJsConfig.fromJson(json['bangleJsConfig']);
}

// i retur-objektet
return BluetoothDeviceInfo(
  device: device,
  name: json['name'] ?? 'Unknown Device',
  id: json['id'] ?? device.id.toString(),
  rssi: -100,
  autoConnect: json['autoConnect'] ?? true,
  notifications: json['notifications'] ?? false,
  status: DeviceConnectionStatus.unavailable,
  isConfigured: configuration?.isConfigured ?? false,
  deviceType: deviceType,
  configuration: configuration?.copyWith(
    bangleJsConfig: bangleConfigFromJson,
  ),
  customName: json['customName'],
  lastConnected:
      json['lastConnected'] != null
          ? DateTime.fromMillisecondsSinceEpoch(json['lastConnected'])
          : null,
  lastConfigured:
      json['lastConfigured'] != null
          ? DateTime.fromMillisecondsSinceEpoch(json['lastConfigured'])
          : null,
  metadata: json['metadata'],
);

// In BluetoothDeviceInfo.toJson()
Map<String, dynamic> toJson() {
  return {
    'id': id,
    'name': name,
    'customName': customName,
    'autoConnect': autoConnect,
    'notifications': notifications,
    'deviceType': deviceType.stringValue,
    'configuration': configuration?.toJson(),
    'lastConnected': lastConnected?.millisecondsSinceEpoch,
    'lastConfigured': lastConfigured?.millisecondsSinceEpoch,
    'metadata': metadata,
    'bangleJsConfig': configuration?.bangleJsConfig?.toJson(), // 👈 NY
  };
}


//----------------- BLOCK 3: BangleData + BangleDataNotifier ------------------


//----------------- Create file bangle_data.dart ------------------

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


//----------------- Create file bangle_data_notifier.dart ------------------

import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
// Anpassa importen till ert BLE-lager:
import 'package:unified_ble/unified_ble.dart';

class BangleDataNotifier extends StateNotifier<BangleData> {
  BangleDataNotifier() : super(const BangleData());

  final UnifiedBleManager _ble = UnifiedBleManager.instance;

  static const String UART_SERVICE = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
  static const String UART_RX = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";
  static const String UART_TX = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

  // 1. Subscribe to UART stream
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

  // 2. Send command
  Future<void> send(String deviceId, String cmd) async {
    await _ble.writeToCharacteristic(
      deviceId,
      Guid(UART_SERVICE),
      Guid(UART_TX),
      utf8.encode(cmd + "\n"),
      false,
    );
  }

  // 3. Apply configuration
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

  // 4. Start / Stop
  Future<void> start(String deviceId) async {
    await send(deviceId, "START");
  }

  Future<void> stop(String deviceId) async {
    await send(deviceId, "STOP");
  }

  // 5. Parse incoming data
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


//----------------- BLOCK 4: UI – sliders + toggles (skiss/byggstenar) ------------------

// Detta block är mer “byggstenar” än färdig UI, men ger nästa utvecklare
// en tydlig startpunkt för en Bangle-konfigurationsskärm.

class BangleConfigurationScreen extends StatelessWidget {
  final BluetoothDeviceInfo deviceInfo;
  final UnifiedDeviceConfiguration config;
  final void Function(UnifiedDeviceConfiguration) onConfigChanged;

  const BangleConfigurationScreen({
    super.key,
    required this.deviceInfo,
    required this.config,
    required this.onConfigChanged,
  });

  @override
  Widget build(BuildContext context) {
    final bangleConfig = config.bangleJsConfig ??
        BangleJsConfig(
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

    return Scaffold(
      appBar: AppBar(
        title: Text(deviceInfo.displayName),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Sampling frequency (Hz)',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          Slider(
            min: 1,
            max: 50,
            divisions: 49,
            value: bangleConfig.samplingFrequency.toDouble(),
            label: '${bangleConfig.samplingFrequency} Hz',
            onChanged: (v) {
              _updateConfig(
                bangleConfig.copyWith(
                  samplingFrequency: v.round(),
                ),
              );
            },
          ),
          const SizedBox(height: 16),
          const Text(
            'Transmission interval (ms)',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          Slider(
            min: 50,
            max: 2000,
            divisions: 39,
            value: bangleConfig.transmissionInterval.toDouble(),
            label: '${bangleConfig.transmissionInterval} ms',
            onChanged: (v) {
              _updateConfig(
                bangleConfig.copyWith(
                  transmissionInterval: v.round(),
                ),
              );
            },
          ),
          const Divider(height: 32),
          const Text(
            'Sensors',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
          SwitchListTile(
            title: const Text('Heart Rate (HRM)'),
            value: bangleConfig.hrmEnabled,
            onChanged: (val) {
              _updateConfig(
                bangleConfig.copyWith(hrmEnabled: val),
              );
            },
          ),
          SwitchListTile(
            title: const Text('Accelerometer'),
            value: bangleConfig.accelEnabled,
            onChanged: (val) {
              _updateConfig(
                bangleConfig.copyWith(accelEnabled: val),
              );
            },
          ),
          SwitchListTile(
            title: const Text('Gyroscope'),
            value: bangleConfig.gyroEnabled,
            onChanged: (val) {
              _updateConfig(
                bangleConfig.copyWith(gyroEnabled: val),
              );
            },
          ),
          SwitchListTile(
            title: const Text('Barometer'),
            value: bangleConfig.barometerEnabled,
            onChanged: (val) {
              _updateConfig(
                bangleConfig.copyWith(barometerEnabled: val),
              );
            },
          ),
          SwitchListTile(
            title: const Text('Light'),
            value: bangleConfig.lightEnabled,
            onChanged: (val) {
              _updateConfig(
                bangleConfig.copyWith(lightEnabled: val),
              );
            },
          ),
          SwitchListTile(
            title: const Text('Steps'),
            value: bangleConfig.stepsEnabled,
            onChanged: (val) {
              _updateConfig(
                bangleConfig.copyWith(stepsEnabled: val),
              );
            },
          ),
          SwitchListTile(
            title: const Text('Magnetometer'),
            value: bangleConfig.magnetometerEnabled,
            onChanged: (val) {
              _updateConfig(
                bangleConfig.copyWith(magnetometerEnabled: val),
              );
            },
          ),
        ],
      ),
    );
  }

  void _updateConfig(BangleJsConfig newBangleConfig) {
    final updated = config.copyWith(bangleJsConfig: newBangleConfig);
    onConfigChanged(updated);
  }
}


//----------------- BLOCK 5: Acquisition-flow + Start/Stop-integration ------------------

// Detta block binder ihop:
// - BluetoothDeviceInfo
// - UnifiedDeviceConfiguration
// - BangleDataNotifier
// - Start/Stop-flödet

class BangleAcquisitionController {
  final BangleDataNotifier dataNotifier;
  final UnifiedDeviceConfiguration config;
  final BluetoothDeviceInfo deviceInfo;

  BangleAcquisitionController({
    required this.dataNotifier,
    required this.config,
    required this.deviceInfo,
  });

  Future<void> startAcquisition() async {
    // 1. Se till att vi är anslutna (pseudo – nästa dev fyller i)
    // await someConnectionManager.ensureConnected(deviceInfo);

    // 2. Prenumerera på data
    await dataNotifier.subscribe(deviceInfo.id);

    // 3. Skicka konfiguration till klockan
    await dataNotifier.applyConfig(deviceInfo.id, config);

    // 4. Starta mätning
    await dataNotifier.start(deviceInfo.id);
  }

  Future<void> stopAcquisition() async {
    await dataNotifier.stop(deviceInfo.id);
    // ev. avregistrera notifikationer etc.
  }
}

// Exempel på hur detta kan användas i en Riverpod-miljö eller liknande:
// final bangleDataProvider = StateNotifierProvider<BangleDataNotifier, BangleData>(
//   (ref) => BangleDataNotifier(),
// );
//
// När användaren trycker "Start":
// final notifier = ref.read(bangleDataProvider.notifier);
// final controller = BangleAcquisitionController(
//   dataNotifier: notifier,
//   config: currentConfig,
//   deviceInfo: currentDeviceInfo,
// );
// await controller.startAcquisition();
//
// När användaren trycker "Stop":
// await controller.stopAcquisition();

