import * as React from 'react';
import {Platform, ScrollView, StyleSheet, Text, View} from 'react-native';
import {Button} from '../components/ui/Button';
import {BottomSheetModal} from '../components/ui/BottomSheetModal';
import {spacing, useRubanColors} from '../design/tokens';
import {
  appRpcReviewQueue,
  type RpcReviewRequest,
} from './rpcReviewQueue';

type RpcRequestReviewContextValue = {
  review: (request: RpcReviewRequest) => Promise<void>;
  cancelSession: (sessionId: string) => void;
};

const RpcRequestReviewContext =
  React.createContext<RpcRequestReviewContextValue | null>(null);

export function RpcRequestReviewProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const colors = useRubanColors();
  const queue = appRpcReviewQueue;
  const active = React.useSyncExternalStore(
    queue.subscribe,
    queue.getActive,
    queue.getActive,
  );

  React.useEffect(() => () => queue.dispose(), [queue]);

  const value = React.useMemo<RpcRequestReviewContextValue>(
    () => ({
      review: request => {
        const review = queue.request(request);
        console.info(
          `RUBAN_DAPP_REVIEW_PENDING ${JSON.stringify({
            requestId: request.id,
            method: request.method,
          })}`,
        );
        return review;
      },
      cancelSession: sessionId => queue.cancelSession(sessionId),
    }),
    [queue],
  );

  return (
    <RpcRequestReviewContext.Provider value={value}>
      {children}
      <BottomSheetModal
        visible={active != null}
        title={active?.title || 'Review request'}
        onDismiss={() => queue.reject()}
        overlayId="dapp-rpc-review"
        testID="dapp-rpc-review-sheet">
        {active ? (
          <View style={styles.content}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}>
              <View style={styles.identity}>
                <Text style={[styles.origin, {color: colors.ink}]}>
                  {active.origin.replace(/^https?:\/\//, '')}
                </Text>
                {active.badge ? (
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: colors.accentSoft,
                        borderColor: colors.border,
                      },
                    ]}>
                    <Text style={[styles.badgeText, {color: colors.accent}]}>
                      {active.badge}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={[styles.facts, {borderColor: colors.border}]}> 
                {active.rows.map((row, index) => (
                  <View
                    key={`${row.label}-${index}`}
                    style={[
                      styles.row,
                      index > 0 ? {borderTopColor: colors.border} : undefined,
                      index > 0 ? styles.rowBorder : undefined,
                    ]}>
                    <Text style={[styles.label, {color: colors.faint}]}>
                      {row.label}
                    </Text>
                    <Text
                      selectable
                      style={[
                        styles.value,
                        {
                          color:
                            row.emphasis === 'warning'
                              ? colors.alert
                              : colors.ink,
                        },
                      ]}>
                      {row.value}
                    </Text>
                  </View>
                ))}
              </View>

              {active.payload ? (
                <View
                  style={[
                    styles.payload,
                    {
                      backgroundColor: colors.surfaceRaised,
                      borderColor: colors.border,
                    },
                  ]}>
                  <Text style={[styles.label, {color: colors.faint}]}>DATA</Text>
                  <Text
                    selectable
                    style={[styles.payloadValue, {color: colors.muted}]}>
                    {active.payload}
                  </Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.actions}>
              <Button
                testID="dapp-rpc-review-reject"
                variant="outline"
                style={styles.action}
                onPress={() => queue.reject()}>
                REJECT
              </Button>
              <Button
                testID="dapp-rpc-review-approve"
                style={styles.action}
                onPress={() => queue.approve()}>
                {active.approveLabel || 'APPROVE'}
              </Button>
            </View>
          </View>
        ) : null}
      </BottomSheetModal>
    </RpcRequestReviewContext.Provider>
  );
}

export function useRpcRequestReview(): RpcRequestReviewContextValue {
  const context = React.useContext(RpcRequestReviewContext);
  if (!context) {
    throw new Error(
      'useRpcRequestReview must be used within RpcRequestReviewProvider',
    );
  }
  return context;
}

const styles = StyleSheet.create({
  content: {paddingHorizontal: spacing.lg, paddingBottom: spacing.md},
  scroll: {maxHeight: 480},
  scrollContent: {paddingTop: spacing.lg, paddingBottom: spacing.md},
  identity: {
    minHeight: 32,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  origin: {flex: 1, fontSize: 16, lineHeight: 21, fontWeight: '800'},
  badge: {
    marginLeft: spacing.md,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderRadius: 5,
  },
  badgeText: {fontSize: 8, lineHeight: 11, fontWeight: '900', letterSpacing: 1},
  facts: {borderWidth: 1, borderRadius: 8},
  row: {paddingHorizontal: spacing.md, paddingVertical: 12},
  rowBorder: {borderTopWidth: 1},
  label: {fontSize: 8, lineHeight: 11, fontWeight: '900', letterSpacing: 1.1},
  value: {marginTop: 5, fontSize: 13, lineHeight: 18, fontWeight: '700'},
  payload: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: 8,
  },
  payloadValue: {
    marginTop: 8,
    fontSize: 11,
    lineHeight: 17,
    fontFamily: Platform.select({ios: 'Menlo', android: 'monospace'}),
  },
  actions: {flexDirection: 'row', gap: spacing.sm},
  action: {flex: 1},
});
