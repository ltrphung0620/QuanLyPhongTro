import { ActivityIndicator, StyleSheet, View } from 'react-native';

export default function IndexScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#7f5f55" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fbf7f4',
  },
});
