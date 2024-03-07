import React from 'react';
import { StatusBar, StatusBarStyle } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, SafeAreaView } from 'react-native';
import { Provider } from 'react-redux';
import { Main } from './src/main';
import { store } from './src/app/store';

export default function App() {
  return (
    <Provider store={store}>
      <StatusBar style="light"/>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.highlight}>
          <Main/>
        </View>
      </SafeAreaView>
    </Provider>
     );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  highlight: {
      flex: 1,
      backgroundColor: '#000000',
      alignItems: 'center',
      justifyContent: 'center',
  },
})