#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include "Adafruit_VL53L0X.h"

// --- WI-FI ---
const char* ssid = "Nero";
const char* password = "12345678";

// Broker MQTT Público
const char* mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;

// Tópicos MQTT
const char* topic_comando = "projeto_trena/comando";
const char* topic_resultado = "projeto_trena/resultado";

// Objetos
WiFiClient espClient;
PubSubClient client(espClient);
Adafruit_VL53L0X lox = Adafruit_VL53L0X();

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Conectando WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Conectado!");
}

void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Mensagem recebida: ");
  
  String msg = "";
  for (int i = 0; i < length; i++) {
    msg += (char)payload[i];
  }
  Serial.println(msg);

  if (msg == "MEDIR") {
    Serial.println("Medindo...");
    VL53L0X_RangingMeasurementData_t measure;
    lox.rangingTest(&measure, false);

    String resultado = "Objeto fora de alcance";
    if (measure.RangeStatus != 4) {
      resultado = String(measure.RangeMilliMeter);
    }
    
    Serial.print("Distancia: "); Serial.println(resultado);
    
    // Publica o resultado de volta pro App
    client.publish(topic_resultado, resultado.c_str());
  }
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Conectando MQTT...");
    String clientId = "ESP32Client-";
    clientId += String(random(0xffff), HEX);
    
    if (client.connect(clientId.c_str())) {
      Serial.println("Conectado!");
      client.subscribe(topic_comando);
    } else {
      Serial.print("Falha, rc=");
      Serial.print(client.state());
      Serial.println(" tentando em 5s");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);

  if (!lox.begin()) {
    Serial.println(F("Falha ao iniciar VL53L0X"));
  }

  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
}