import {
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
    useColorScheme, Platform
} from "react-native"
  
import {
    DebugInstructions,
    LearnMoreLinks,
    ReloadInstructions,
} from "react-native/Libraries/NewAppScreen"

import { Counter } from './features/counter/Counter'
import { MainScreen } from './features/main-screen/MainScreen'

  export const Main = () => {
    const isDarkMode = useColorScheme() === "dark"
  
    return (
    <>
    <StatusBar/>
        <View style={styles.mainScreen}> 
          <MainScreen/>
        </View>
    </>
    )
  }

const styles = StyleSheet.create({
  mainScreen: {
    // Common styles
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        width: 480, // Fixed width for web
        height: 640, // Fixed height for web
      },
      default: {
        width: '90%', // Percentage width for mobile
        aspectRatio: 3 / 4, // Maintain 4:3 ratio for mobile
      }
    })
  },
  // ... other styles
});