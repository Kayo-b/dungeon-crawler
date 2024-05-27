import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button } from 'react-native';
import { store } from '../../app/store';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { incremented, amoutAdded } from './counterSlice';

export const Counter = () => {
  const dispatch = useAppDispatch(); 
  const count = useAppSelector(state => state.counter.value); 

  return (
    <View style={styles.container}>
      <Text>Count: {count}</Text>
      <Button title="Increment" onPress={() => dispatch(amoutAdded(3))} /> 
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffff',
  },
});
