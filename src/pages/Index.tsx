import { Layout } from '@/components/Layout';
import { Home } from './Home';
import { Library } from './Library';
import { PlayerView } from './PlayerView';
import { Stats } from './Stats';
import Settings from './Settings';
import { useAppStore } from '@/store/appStore';

const Index = () => {
  const { currentView } = useAppStore();

  const renderView = () => {
    switch (currentView) {
      case 'library':
        return <Library />;
      case 'stats':
        return <Stats />;
      case 'settings':
        return <Settings />;
      case 'player':
        return <PlayerView />;
      default:
        return <Home />;
    }
  };

  return (
    <Layout>
      {renderView()}
    </Layout>
  );
};

export default Index;
