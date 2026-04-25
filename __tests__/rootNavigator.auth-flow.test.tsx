import React from "react";
import renderer, { act } from "react-test-renderer";
import RootNavigator from "../navigation/RootNavigator";
import { useAuthFlowStore } from "../state/authFlowStore";

const mockSyncStore = {
  startFirestoreWatch: jest.fn(),
  storeHydrated: true,
  resetForUser: jest.fn(),
};

const mockAppModeStore = {
  mode: "player" as "player" | "coach" | null,
  loading: false,
  loadForUid: jest.fn(),
};

let mockAuthListener: ((user: { uid: string } | null) => void) | null = null;
let mockProfileListener: ((snapshot: { data: () => Record<string, unknown> | undefined }) => void) | null = null;

function mockCreateScreen(label: string) {
  return function MockScreen() {
    const { Text } = require("react-native");
    return <Text>{label}</Text>;
  };
}

function mockCreateNavigator() {
  const ReactRuntime = require("react");
  const { View } = require("react-native");

  return {
    Navigator: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    Screen: ({
      name,
      component: Component,
      children,
    }: {
      name: string;
      component?: React.ComponentType<any>;
      children?: (props: any) => React.ReactNode;
    }) => {
      const navigation = {
        navigate: jest.fn(),
        reset: jest.fn(),
        goBack: jest.fn(),
        canGoBack: () => true,
      };
      const route = { name, params: undefined };

      if (typeof children === "function") {
        return <ReactRuntime.Fragment>{children({ navigation, route })}</ReactRuntime.Fragment>;
      }

      return Component ? <Component navigation={navigation} route={route} /> : null;
    },
  };
}

jest.mock("@react-navigation/native-stack", () => ({
  createNativeStackNavigator: mockCreateNavigator,
}));

jest.mock("@react-navigation/bottom-tabs", () => ({
  createBottomTabNavigator: mockCreateNavigator,
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async () => "true"),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock("../services/firebase", () => ({
  auth: { currentUser: null, signOut: jest.fn() },
  db: {},
}));

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: jest.fn((_auth: unknown, callback: (user: { uid: string } | null) => void) => {
    mockAuthListener = callback;
    return jest.fn();
  }),
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(() => ({ path: "users/mock" })),
  onSnapshot: jest.fn(
    (
      _ref: unknown,
      callback: (snapshot: { data: () => Record<string, unknown> | undefined }) => void,
    ) => {
      mockProfileListener = callback;
      return jest.fn();
    },
  ),
}));

jest.mock("../state/stores/useSyncStore", () => ({
  useSyncStore: (selector: (state: typeof mockSyncStore) => unknown) => selector(mockSyncStore),
}));

jest.mock("../state/appModeStore", () => ({
  useAppModeStore: (selector: (state: typeof mockAppModeStore) => unknown) => selector(mockAppModeStore),
}));

jest.mock("../services/analytics", () => ({
  setAnalyticsUserId: jest.fn(),
}));

jest.mock("../services/monitoring", () => ({
  setSentryUser: jest.fn(),
}));

jest.mock("../config/devFlags", () => ({
  DEV_FLAGS: {
    FORCE_WELCOME: false,
  },
}));

jest.mock("../components/SwipeTabsWrapper", () => ({
  SwipeTabsWrapper: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("react-native-safe-area-context", () => {
  const ReactRuntime = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    SafeAreaView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

jest.mock("../screens/HomeScreen", () => mockCreateScreen("HomeScreen"));
jest.mock("../screens/NewSessionScreen", () => mockCreateScreen("NewSessionScreen"));
jest.mock("../screens/FeedbackScreen", () => mockCreateScreen("FeedbackScreen"));
jest.mock("../screens/ExternalLoadScreen", () => mockCreateScreen("ExternalLoadScreen"));
jest.mock("../screens/RegisterScreen", () => mockCreateScreen("RegisterScreen"));
jest.mock("../screens/LoginScreen", () => mockCreateScreen("LoginScreen"));
jest.mock("../screens/ProfileSetupScreen", () => mockCreateScreen("ProfileSetupScreen"));
jest.mock("../screens/VideoLibraryScreen", () => mockCreateScreen("VideoLibraryScreen"));
jest.mock("../screens/SessionPreviewScreen", () => mockCreateScreen("SessionPreviewScreen"));
jest.mock("../screens/SessionHubScreen", () => mockCreateScreen("SessionHubScreen"));
jest.mock("../screens/SessionHistoryScreen", () => mockCreateScreen("SessionHistoryScreen"));
jest.mock("../screens/PrebuiltSessionsScreen", () => mockCreateScreen("PrebuiltSessionsScreen"));
jest.mock("../screens/PrebuiltSessionDetailScreen", () => mockCreateScreen("PrebuiltSessionDetailScreen"));
jest.mock("../screens/ProfileScreen", () => mockCreateScreen("ProfileScreen"));
jest.mock("../screens/TestsScreen", () => mockCreateScreen("TestsScreen"));
jest.mock("../screens/WelcomeScreen", () => mockCreateScreen("WelcomeScreen"));
jest.mock("../screens/SessionLiveScreen", () => mockCreateScreen("SessionLiveScreen"));
jest.mock("../screens/SessionSummaryScreen", () => mockCreateScreen("SessionSummaryScreen"));
jest.mock("../screens/SettingsScreen", () => mockCreateScreen("SettingsScreen"));
jest.mock("../screens/LegalNoticeScreen", () => mockCreateScreen("LegalNoticeScreen"));
jest.mock("../screens/PrivacyPolicyScreen", () => mockCreateScreen("PrivacyPolicyScreen"));
jest.mock("../screens/RoutineScreen", () => mockCreateScreen("RoutineScreen"));
jest.mock("../screens/CoachDashboardScreen", () => mockCreateScreen("CoachDashboardScreen"));
jest.mock("../screens/CoachPlayerDetailScreen", () => mockCreateScreen("CoachPlayerDetailScreen"));
jest.mock("../screens/ChatScreen", () => mockCreateScreen("ChatScreen"));
jest.mock("../screens/CycleModalScreen", () => mockCreateScreen("CycleModalScreen"));
jest.mock("../screens/ProgressScreen", () => mockCreateScreen("ProgressScreen"));

describe("RootNavigator auth flow", () => {
  beforeEach(() => {
    mockAuthListener = null;
    mockProfileListener = null;
    mockAppModeStore.mode = "player";
    mockAppModeStore.loading = false;
    useAuthFlowStore.getState().clearProfileCompleted();
  });

  it("switches from profile setup to the app as soon as profile completion is marked locally", async () => {
    let tree: any;

    await act(async () => {
      tree = renderer.create(<RootNavigator />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(JSON.stringify(tree!.toJSON())).toContain("LoginScreen");

    await act(async () => {
      mockAuthListener?.({ uid: "user-1" });
    });

    await act(async () => {
      mockProfileListener?.({
        data: () => ({ profileCompleted: false }),
      });
    });

    expect(JSON.stringify(tree!.toJSON())).toContain("ProfileSetupScreen");

    await act(async () => {
      useAuthFlowStore.getState().markProfileCompleted("user-1");
    });

    expect(JSON.stringify(tree!.toJSON())).toContain("HomeScreen");
  });
});
