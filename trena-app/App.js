import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Alert, SafeAreaView, Share } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import Paho from 'paho-mqtt';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';

// --- CONFIGURAÇÕES MQTT ---
const MQTT_BROKER = 'broker.hivemq.com';
const MQTT_PORT = 8000;
const TOPIC_CMD = 'projeto_trena/comando';
const TOPIC_RES = 'projeto_trena/resultado';

const Stack = createStackNavigator();

// ==========================================
// COMPONENTE: CABEÇALHO DE NAVEGAÇÃO
// ==========================================
const CustomHeader = ({ title, navigation, showButtons = false }) => {
  return (
    <View style={styles.headerRow}>
      {showButtons ? (
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
          <MaterialIcons name="arrow-back" size={28} color="white" />
        </TouchableOpacity>
      ) : <View style={{width: 28}} />} 

      <Text style={styles.headerTitle}>{title}</Text>

      {showButtons ? (
        <TouchableOpacity onPress={() => navigation.popToTop()} style={styles.iconButton}>
          <MaterialIcons name="home" size={28} color="white" />
        </TouchableOpacity>
      ) : <View style={{width: 28}} />}
    </View>
  );
};

// ==========================================
// TELA 1: FORMULÁRIO INICIAL
// ==========================================
function FormScreen({ navigation }) {
  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [data, setData] = useState(new Date().toLocaleDateString('pt-BR'));

  const iniciar = () => {
    if (!nome || !endereco) {
      Alert.alert('Atenção', 'Preencha nome e endereço!');
      return;
    }
    navigation.navigate('Medicao', { nome, endereco, data });
  };

  return (
    <SafeAreaView style={styles.container}>
      <CustomHeader title="Nova Medida" navigation={navigation} showButtons={false} />

      <ScrollView contentContainerStyle={{flexGrow: 1, justifyContent: 'center'}}>
        <View style={styles.card}>
          <Text style={styles.label}>Cliente</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Nome do Cliente" 
            placeholderTextColor="#666"
            value={nome} onChangeText={setNome} 
          />
          <Text style={styles.label}>Endereço</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Endereço Completo" 
            placeholderTextColor="#666"
            value={endereco} onChangeText={setEndereco} 
          />
          <Text style={styles.label}>Data</Text>
          <TextInput 
            style={[styles.input, {backgroundColor: '#333', color:'#aaa'}]} 
            value={data} editable={false} 
          />
        </View>

        <TouchableOpacity style={styles.buttonPrimary} onPress={iniciar}>
          <Text style={styles.btnTextPrimary}>INICIAR MEDIÇÃO</Text>
          <MaterialIcons name="arrow-forward" size={24} color="black" style={{marginLeft: 10}} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ==========================================
// TELA 2: MEDIÇÃO
// ==========================================
function MeasureScreen({ route, navigation }) {
  const { nome, endereco, data } = route.params;
  const [client, setClient] = useState(null);
  const [status, setStatus] = useState('Conectando...');
  const [statusColor, setStatusColor] = useState('yellow');
  const [medida, setMedida] = useState('---');
  const [obs, setObs] = useState('');
  const [lista, setLista] = useState([]);

  useEffect(() => {
    const c = new Paho.Client(MQTT_BROKER, MQTT_PORT, "App-" + parseInt(Math.random() * 1000));
    c.onConnectionLost = (responseObject) => {
      if (responseObject.errorCode !== 0) {
        setStatus('Desconectado');
        setStatusColor('red');
      }
    };
    c.onMessageArrived = (message) => setMedida(message.payloadString);
    c.connect({
      onSuccess: () => {
        setStatus('Conectado ao ESP32');
        setStatusColor('#00E676');
        c.subscribe(TOPIC_RES);
      },
      onFailure: () => {
        setStatus('Falha na Conexão');
        setStatusColor('red');
      },
      useSSL: false
    });
    setClient(c);
    return () => { if(c.isConnected()) c.disconnect(); };
  }, []);

  const pedirMedida = () => {
    if (client && client.isConnected()) {
      const message = new Paho.Message("MEDIR");
      message.destinationName = TOPIC_CMD;
      client.send(message);
      setMedida("...");
    } else {
      Alert.alert("Erro", "Sem conexão MQTT");
    }
  };

  const salvarItem = () => {
    if (medida === '---' || medida === '...') return Alert.alert("Faça uma leitura!");
    if (!obs) return Alert.alert("Escreva uma observação.");
    setLista([{ obs, valor: medida }, ...lista]);
    setMedida('---');
    setObs('');
  };

  const excluirItem = (index) => {
    Alert.alert("Excluir", "Remover?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sim", style: "destructive", onPress: () => {
          const nova = [...lista];
          nova.splice(index, 1);
          setLista(nova);
      }}
    ]);
  };

  const editarItem = (index) => {
    const item = lista[index];
    setObs(item.obs);
    setMedida(item.valor);
    const nova = [...lista];
    nova.splice(index, 1);
    setLista(nova);
  };

  const irParaRelatorio = () => {
    if (lista.length === 0) return Alert.alert("Vazio", "Adicione medidas antes de finalizar.");
    navigation.navigate('Relatorio', { nome, endereco, data, lista });
  };

  return (
    <SafeAreaView style={styles.container}>
      <CustomHeader title="Medição" navigation={navigation} showButtons={true} />

      <View style={styles.statusHeader}>
        <View style={[styles.statusDot, {backgroundColor: statusColor}]} />
        <Text style={styles.statusText}>{status}</Text>
      </View>
      
      <View style={styles.displayContainer}>
        <Text style={styles.displayText}>{medida} <Text style={{fontSize:20, color:'#666'}}>mm</Text></Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.measureBtn} onPress={pedirMedida}>
          <MaterialIcons name="settings-remote" size={24} color="black" style={{marginRight:10}} />
          <Text style={styles.measureBtnText}>LER MEDIDA</Text>
        </TouchableOpacity>

        <View style={styles.row}>
          <TextInput 
            style={[styles.input, {flex: 1, marginBottom: 0}]} 
            placeholder="Obs: Parede Sala" 
            placeholderTextColor="#666"
            value={obs} onChangeText={setObs} 
          />
          <TouchableOpacity style={styles.addBtn} onPress={salvarItem}>
            <MaterialIcons name="add" size={28} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{flex: 1, backgroundColor: '#1E1E1E', borderRadius: 12, padding: 10, marginBottom: 10}}>
        <ScrollView>
          {lista.map((item, index) => (
            <View key={index} style={styles.listItem}>
              <View style={{flex: 1}}>
                <Text style={styles.itemObs}>{item.obs}</Text>
                <Text style={styles.itemVal}>{item.valor} mm</Text>
              </View>
              <View style={{flexDirection: 'row', gap: 15}}>
                <TouchableOpacity onPress={() => editarItem(index)}>
                  <MaterialIcons name="edit" size={24} color="#29B6F6" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => excluirItem(index)}>
                  <MaterialIcons name="delete" size={24} color="#EF5350" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      <TouchableOpacity style={styles.finishBtn} onPress={irParaRelatorio}>
        <MaterialIcons name="assignment" size={24} color="black" style={{marginRight: 10}} />
        <Text style={styles.finishBtnText}>VER RELATÓRIO</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ==========================================
// TELA 3: RELATÓRIO FINAL
// ==========================================
function ReportScreen({ route, navigation }) {
  const { nome, endereco, data, lista } = route.params;

  const compartilhar = async () => {
    let mensagem = `📋 *RELATÓRIO DE MEDIDAS*\n\n`;
    mensagem += `👤 Cliente: ${nome}\n`;
    mensagem += `📍 Endereço: ${endereco}\n`;
    mensagem += `📅 Data: ${data}\n\n`;
    mensagem += `*MEDIDAS:*\n`;
    
    lista.forEach((item, index) => {
      mensagem += `${index + 1}. ${item.obs}: ${item.valor} mm\n`;
    });

    try {
      await Share.share({
        message: mensagem,
        title: `Medidas - ${nome}`
      });
    } catch (error) {
      Alert.alert(error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <CustomHeader title="Resumo" navigation={navigation} showButtons={true} />
      
      <View style={[styles.card, {flex: 1}]}>
        <Text style={{color:'#00E676', fontSize:18, fontWeight:'bold', marginBottom:10}}>DADOS GERAIS</Text>
        <Text style={styles.reportText}>👤 {nome}</Text>
        <Text style={styles.reportText}>📍 {endereco}</Text>
        <Text style={styles.reportText}>📅 {data}</Text>

        <View style={{height: 1, backgroundColor: '#444', marginVertical: 20}} />

        <Text style={{color:'#00E676', fontSize:18, fontWeight:'bold', marginBottom:10}}>MEDIDAS REALIZADAS</Text>
        <ScrollView>
          {lista.map((item, index) => (
            <View key={index} style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 10}}>
              <Text style={{color:'white', fontSize: 16}}>• {item.obs}</Text>
              <Text style={{color:'#00E676', fontSize: 16, fontWeight:'bold'}}>{item.valor} mm</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <TouchableOpacity style={styles.finishBtn} onPress={compartilhar}>
        <MaterialIcons name="share" size={24} color="black" style={{marginRight: 10}} />
        <Text style={styles.finishBtnText}>COMPARTILHAR (WHATSAPP)</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ==========================================
// ESTILOS E NAVEGAÇÃO
// ==========================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 15 },
  
  headerRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginTop: 20, 
    marginBottom: 20 
  },
  headerTitle: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#fff',
    flex: 1,
    textAlign: 'center' 
  },
  iconButton: {
    padding: 5
  },

  card: { backgroundColor: '#1E1E1E', padding: 20, borderRadius: 15, marginBottom: 20 },
  label: { color: '#00E676', fontSize: 14, marginBottom: 5, fontWeight:'bold' },
  input: { backgroundColor: '#2C2C2C', color: 'white', borderRadius: 8, padding: 12, marginBottom: 15, fontSize: 16 },
  buttonPrimary: { backgroundColor: '#00E676', padding: 18, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent:'center' },
  btnTextPrimary: { color: '#000', fontWeight: 'bold', fontSize: 18 },
  statusHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, marginTop: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  statusText: { color: '#aaa' },
  displayContainer: { backgroundColor: '#1E1E1E', padding: 30, borderRadius: 20, alignItems: 'center', marginBottom: 20 },
  displayText: { fontSize: 60, fontWeight: 'bold', color: '#fff' },
  controls: { gap: 10, marginBottom: 20 },
  measureBtn: { backgroundColor: '#00E676', padding: 15, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent:'center' },
  measureBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  row: { flexDirection: 'row', gap: 10 },
  addBtn: { backgroundColor: '#444', width: 50, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#333', paddingVertical: 15 },
  itemObs: { color: '#ddd', fontSize: 16 },
  itemVal: { color: '#00E676', fontSize: 18, fontWeight: 'bold' },
  finishBtn: { backgroundColor: '#FFA000', padding: 15, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  finishBtnText: { color: '#000', fontWeight: 'bold' },
  reportText: { color: 'white', fontSize: 16, marginBottom: 5 }
});

export default function App() {
  return (
    <NavigationContainer theme={DarkTheme}>
      <StatusBar style="light" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Formulario" component={FormScreen} />
        <Stack.Screen name="Medicao" component={MeasureScreen} />
        <Stack.Screen name="Relatorio" component={ReportScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}