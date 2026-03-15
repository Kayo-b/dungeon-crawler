import React, { useEffect, useRef, useState } from 'react';
import { Animated, ImageBackground, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { fetchEnemies, setAttackRating } from '../../features/enemy/enemySlice';
import { HitEffect } from '../../components/HitEffect';

interface EnemyProps {
  index: number;
  jumpIntoView?: boolean;
  isJustAdvanced?: boolean;
}

export const Enemy: React.FC<EnemyProps> = ({ index, jumpIntoView = false, isJustAdvanced = false }) => {
  const dispatch = useAppDispatch();
  const enemy = useAppSelector((state) => state.enemy.enemies[index]);
  const enemyAttackPulse = useAppSelector((state) => state.combat.enemyAttackPulse);
  const lastEnemyAttackId = useAppSelector((state) => state.combat.lastEnemyAttackId);
  const playerHitPulse = useAppSelector((state) => state.combat.playerHitPulse);
  const lastPlayerHitId = useAppSelector((state) => state.combat.lastPlayerHitId);
  const lastPlayerHitType = useAppSelector((state) => state.combat.lastPlayerHitType);
  const lastPlayerHitDmg = useAppSelector((state) => state.combat.lastPlayerHitDmg);
  const lastPlayerHitCrit = useAppSelector((state) => state.combat.lastPlayerHitCrit);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const attackAnim = useRef(new Animated.Value(0)).current;
  const ambushJumpAnim = useRef(new Animated.Value(0)).current;
  // Advancement animation: springs from mid-row offset (-60) down to front-row (0)
  const advanceAnim = useRef(new Animated.Value(0)).current;
  const prevJustAdvancedRef = useRef(false);
  const [showHitEffect, setShowHitEffect] = useState(false);
  // Floating damage number
  const dmgFadeAnim = useRef(new Animated.Value(0)).current;
  const dmgSlideAnim = useRef(new Animated.Value(0)).current;
  const [dmgDisplay, setDmgDisplay] = useState<{ value: number; crit: boolean }>({ value: 0, crit: false });

  const resources = [
    require('../../resources/skeleton_01.png'),
    require('../../resources/demonrat_01.png'),
    require('../../resources/skeleton_01.png'),
  ];

  useEffect(() => {
    if (!enemy) return;
    dispatch(fetchEnemies());

    const baseAR = enemy.stats.atkSpeed;
    const dex = enemy.stats.dexterity;
    const atkRating = (baseAR + dex * 2) * 2;
    dispatch(setAttackRating({ id: index, rating: atkRating }));
  }, [dispatch, index, enemy?.id]);

  useEffect(() => {
    if (!enemy) return;

    if (enemy.health <= 0) {
      // Delay fade-out so the damage number has time to appear before the enemy disappears
      const t = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }, 350);
      return () => clearTimeout(t);
    } else {
      fadeAnim.setValue(1);
    }
  }, [enemy?.health]);

  useEffect(() => {
    if (lastEnemyAttackId !== index) return;

    attackAnim.setValue(0);
    Animated.sequence([
      Animated.timing(attackAnim, {
        toValue: -14,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(attackAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [enemyAttackPulse]);

  useEffect(() => {
    if (lastPlayerHitId !== index) return;

    setShowHitEffect(true);
    const timeout = setTimeout(() => setShowHitEffect(false), 320);
    return () => clearTimeout(timeout);
  }, [playerHitPulse]);

  useEffect(() => {
    if (lastPlayerHitId !== index) return;
    setDmgDisplay({ value: lastPlayerHitDmg, crit: lastPlayerHitCrit });

    dmgFadeAnim.stopAnimation();
    dmgSlideAnim.stopAnimation();
    dmgFadeAnim.setValue(0);
    dmgSlideAnim.setValue(0);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(dmgFadeAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
        Animated.timing(dmgFadeAnim, { toValue: 0, duration: 620, useNativeDriver: true }),
      ]),
      Animated.timing(dmgSlideAnim, { toValue: -40, duration: 700, useNativeDriver: true }),
    ]).start();
  }, [playerHitPulse]);

  useEffect(() => {
    if (!jumpIntoView) return;

    ambushJumpAnim.setValue(-30);
    Animated.spring(ambushJumpAnim, {
      toValue: 0,
      speed: 18,
      bounciness: 12,
      useNativeDriver: true,
    }).start();
  }, [jumpIntoView, index]);

  // When this enemy advances from a back row to the front, spring it into the front row position
  useEffect(() => {
    const wasAdvanced = prevJustAdvancedRef.current;
    prevJustAdvancedRef.current = isJustAdvanced;
    if (!isJustAdvanced || wasAdvanced) return;

    advanceAnim.setValue(-60);
    Animated.spring(advanceAnim, {
      toValue: 0,
      speed: 5,
      bounciness: 6,
      useNativeDriver: true,
    }).start();
  }, [isJustAdvanced]);

  if (!enemy) return null;
  const enemySprite = resources[enemy.id] || resources[0];
  const isRat = enemy.id === 1;

  const maxHealth = Math.max(Math.floor((enemy as any)?.stats?.health || enemy.health || 1), 1);
  const currentHealth = Math.max(0, Math.min(maxHealth, Math.floor(enemy.health || 0)));
  const hpTrackWidth = Math.floor((isRat ? 62 : 110) * 0.65);
  const hpGap = maxHealth > 34 ? 0 : 1;
  const desiredSegmentSize = isRat ? 3 : 4;
  const desiredTotalWidth = maxHealth * desiredSegmentSize + Math.max(0, maxHealth - 1) * hpGap;
  const fitScale = desiredTotalWidth > hpTrackWidth ? hpTrackWidth / desiredTotalWidth : 1;
  const hpSegmentSize = Math.max(0.75, desiredSegmentSize * fitScale);
  const hpSegments = Array.from({ length: maxHealth }, (_, index) => index < currentHealth);

  return (
    <View style={[styles.enemyRoot, isRat && styles.enemyRootRat]}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: ambushJumpAnim }, { translateY: advanceAnim }, { translateX: attackAnim }] }}>
        <View style={styles.enemyFrame}>
          <View style={[styles.healthBarWrap, isRat && styles.healthBarWrapRat]}>
            <View style={[styles.healthBarTrack, { minHeight: hpSegmentSize + 2, width: hpTrackWidth }]}>
              {hpSegments.map((filled, index) => (
                <View
                  key={`hp-segment-${index}`}
                  style={[
                    styles.healthSegment,
                    {
                      width: hpSegmentSize,
                      height: hpSegmentSize,
                      marginRight: index === maxHealth - 1 ? 0 : hpGap,
                    },
                    filled ? styles.healthSegmentFilled : styles.healthSegmentEmpty,
                  ]}
                />
              ))}
            </View>
          </View>
          <ImageBackground
            source={enemySprite as ImageSourcePropType}
            style={[styles.enemy, isRat && styles.enemyRat]}
            imageStyle={enemy.id === 2 ? styles.archerTint : undefined}
            resizeMode="contain"
          >
            {showHitEffect && (
              <View style={[styles.hitEffectWrap, isRat && styles.hitEffectWrapRat]}>
                <HitEffect variant={lastPlayerHitType} size={isRat ? 44 : 56} />
              </View>
            )}
          </ImageBackground>
        </View>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.dmgNumberWrap, isRat && styles.dmgNumberWrapRat, { opacity: dmgFadeAnim, transform: [{ translateY: dmgSlideAnim }] }]}
      >
        <Text style={[styles.dmgNumberText, dmgDisplay.crit && styles.dmgNumberCrit]}>
          -{dmgDisplay.value}
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  enemyRoot: {
    width: 150,
    height: 170,
    alignSelf: 'center',
    position: 'absolute',
    top: 54,
  },
  enemyRootRat: {
    width: 90,
    height: 108,
    top: 76,
  },
  enemyFrame: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  enemy: {
    width: 150,
    height: 150,
    alignSelf: 'center',
    position: 'absolute',
    top: 20,
  },
  enemyRat: {
    width: 80,
    height: 80,
    top: 14,
  },
  healthBarWrap: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    zIndex: 7,
  },
  healthBarWrapRat: {
    left: 12,
    right: 12,
  },
  healthBarTrack: {
    backgroundColor: '#0b0b0b',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#d7d7d7',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 1,
    paddingVertical: 1,
  },
  healthSegment: {
    borderWidth: 1,
    borderColor: '#000000',
  },
  healthSegmentFilled: {
    backgroundColor: '#dc2626',
  },
  healthSegmentEmpty: {
    backgroundColor: '#301010',
  },
  hitEffectWrap: {
    position: 'absolute',
    top: -24,
    left: 42,
    zIndex: 5,
  },
  hitEffectWrapRat: {
    top: -16,
    left: 30,
  },
  dmgNumberWrap: {
    position: 'absolute',
    top: 16,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
    pointerEvents: 'none',
  },
  dmgNumberWrapRat: {
    top: 10,
  },
  dmgNumberText: {
    color: '#ff4444',
    fontSize: 18,
    fontWeight: '900',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  dmgNumberCrit: {
    color: '#ffd700',
    fontSize: 22,
  },
  archerTint: {
    tintColor: '#8fc6ff',
    opacity: 0.94,
  },
});
