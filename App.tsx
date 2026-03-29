import React from 'react';
import MainNavigator from './src/navigation';
import { View } from 'react-native';
import { I18nextProvider } from 'react-i18next';
import i18n from './src/i18n';

function App(): React.JSX.Element {
    return (
      <I18nextProvider i18n={i18n}>
        <View style={{ flex: 1 }}>
          <MainNavigator />
        </View>
      </I18nextProvider>
    );
}

export default App;
