import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { useAppSelector, useAppDispatch } from '../../app/hooks';
import { movementDebug, MovementEvent, DebugState } from '../../utils/debug';
import { loadMap, loadMapConfig, resetPosition } from './roomSlice';
import { getMapList, MapInfo } from '../../data/maps';
import { generateMap, generateFromPreset, PRESETS, MapGeneratorOptions } from '../../systems/mapGen/MapGenerator';
import { generateFromTemplate, getTemplateList, TemplateType } from '../../systems/mapGen/MapTemplates';
import { MovementTester, TestResult, TestState, runMovementSequence, runPathWalkTest, getTurnTileInfo, formatTestResults, testAllDirectionsFromPosition, CorridorTestResult, formatCorridorTestResults, validateCurrentState, testTurnDesync, TurnDesyncTestResult } from '../../utils/movementTest';
import { TileType, Direction } from '../../types/map';
import { analyzeView, ViewDebugState, RenderedTileInfo, getPerpendicularTiles, getExpectedVisual, getTileImageName } from '../../utils/viewDebug';

interface DebugOverlayProps {
  visible?: boolean;
  mapArray?: number[];
  pathTileArr?: NodeRequire[];
  verticalTileArr?: number[][];
  dg_map?: number[][];
}

export const DebugOverlay: React.FC<DebugOverlayProps> = ({
  visible = true,
  mapArray,
  pathTileArr,
  verticalTileArr,
  dg_map,
}) => {
  const dispatch = useAppDispatch();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMapSelector, setShowMapSelector] = useState(false);
  const [showMapGenerator, setShowMapGenerator] = useState(false);
  const [history, setHistory] = useState<MovementEvent[]>([]);
  const [, forceUpdate] = useState({});
  const [availableMaps] = useState<MapInfo[]>(getMapList());
  const [templates] = useState(getTemplateList());

  // Map generator state
  const [genWidth, setGenWidth] = useState('8');
  const [genHeight, setGenHeight] = useState('8');
  const [selectedPreset, setSelectedPreset] = useState<string>('moderate');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('loop');

  // Test panel state
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [sequenceResults, setSequenceResults] = useState<{ states: any[]; errors: string[] } | null>(null);
  const [pathWalkResults, setPathWalkResults] = useState<{ visitedCount: number; totalWalkable: number; errors: string[] } | null>(null);
  const [turnTileInfo, setTurnTileInfo] = useState<{ turnDirection: string; connections: string[] } | null>(null);
  const [corridorTestResults, setCorridorTestResults] = useState<CorridorTestResult[] | null>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // View debug state
  const [showViewDebug, setShowViewDebug] = useState(false);
  const [viewDebugState, setViewDebugState] = useState<ViewDebugState | null>(null);
  const [liveViewDebug, setLiveViewDebug] = useState(false);

  // State validation
  const [stateValidation, setStateValidation] = useState<{
    isValid: boolean;
    expectedArrPos: number;
    actualArrPos: number;
    mismatch: number;
    details: string;
  } | null>(null);
  const [desyncTest, setDesyncTest] = useState<TurnDesyncTestResult | null>(null);
  const [liveValidation, setLiveValidation] = useState(false);

  // Redux state
  const positionX = useAppSelector(state => state.room.posX);
  const positionY = useAppSelector(state => state.room.posY);
  const currentDir = useAppSelector(state => state.room.direction);
  const currentArrPos = useAppSelector(state => state.room.currentArrPos);
  const iniDir = useAppSelector(state => state.room.initialDirection);
  const lastTurnDir = useAppSelector(state => state.room.lastTurnDir);
  const currentMapId = useAppSelector(state => state.room.currentMapId);
  const mapWidth = useAppSelector(state => state.room.mapWidth);
  const mapHeight = useAppSelector(state => state.room.mapHeight);
  const mapTiles = useAppSelector(state => state.room.mapTiles);
  const verticalTiles = useAppSelector(state => state.room.verticalTiles);

  // Get current tile type
  const getCurrentTileType = (): number => {
    if (!verticalTileArr || !dg_map) return -1;
    if (currentDir === 'N' || currentDir === 'S') {
      return verticalTileArr[positionX]?.[positionY] ?? -1;
    }
    return dg_map[positionY]?.[positionX] ?? -1;
  };

  const currentTileType = getCurrentTileType();

  // Subscribe to debug updates
  useEffect(() => {
    movementDebug.setOnUpdate(() => {
      setHistory(movementDebug.getRecentHistory(10));
      forceUpdate({});
    });

    // Take initial snapshot
    movementDebug.snapshot({
      position: { x: positionX, y: positionY },
      direction: currentDir as 'N' | 'S' | 'E' | 'W',
      tileType: currentTileType,
      currentArrPos,
      iniDir,
      lastTurnDir,
      mapArrayLength: mapArray?.length ?? 0,
      pathTileCount: pathTileArr?.length ?? 0,
    });
  }, []);

  // Update snapshot on state change
  useEffect(() => {
    movementDebug.snapshot({
      position: { x: positionX, y: positionY },
      direction: currentDir as 'N' | 'S' | 'E' | 'W',
      tileType: currentTileType,
      currentArrPos,
      iniDir,
      lastTurnDir,
      mapArrayLength: mapArray?.length ?? 0,
      pathTileCount: pathTileArr?.length ?? 0,
    });
  }, [positionX, positionY, currentDir, currentArrPos, iniDir, lastTurnDir]);

  // Run movement tests
  const runTests = () => {
    if (!mapTiles || mapTiles.length === 0) {
      setTestResults([{
        name: 'Map Load Check',
        passed: false,
        message: 'No map loaded! Load a map first.',
      }]);
      return;
    }

    setIsRunningTests(true);

    const testState: TestState = {
      position: { x: positionX, y: positionY },
      direction: currentDir as Direction,
      currentArrPos,
      iniDir,
    };

    const tester = new MovementTester(mapTiles as TileType[][], mapWidth, mapHeight);
    const results = tester.runAllTests(testState);

    setTestResults(results);
    setIsRunningTests(false);
  };

  // Run movement sequence test
  const runSequenceTest = () => {
    if (!mapTiles || mapTiles.length === 0) return;

    setIsRunningTests(true);

    const initialState: TestState = {
      position: { x: positionX, y: positionY },
      direction: currentDir as Direction,
      currentArrPos,
      iniDir,
    };

    // Test sequence: try all basic movements
    const moves: Array<'forward' | 'reverse' | 'turn_L' | 'turn_R'> = [
      'forward', 'forward', 'turn_R', 'forward', 'turn_L',
      'forward', 'reverse', 'forward', 'turn_R', 'turn_R',
      'forward', 'forward', 'turn_L', 'forward',
    ];

    const results = runMovementSequence(
      initialState,
      moves,
      mapTiles as TileType[][],
      mapWidth,
      mapHeight
    );

    setSequenceResults(results);
    setIsRunningTests(false);
  };

  // Run path walk test
  const runPathWalk = () => {
    if (!mapTiles || mapTiles.length === 0) return;

    setIsRunningTests(true);

    const initialState: TestState = {
      position: { x: positionX, y: positionY },
      direction: currentDir as Direction,
      currentArrPos,
      iniDir,
    };

    const results = runPathWalkTest(
      initialState,
      mapTiles as TileType[][],
      mapWidth,
      mapHeight
    );

    setPathWalkResults({
      visitedCount: results.visitedCount,
      totalWalkable: results.totalWalkable,
      errors: results.errors,
    });
    setIsRunningTests(false);
  };

  // Check current turn tile info
  const checkTurnTile = () => {
    if (!mapTiles || mapTiles.length === 0) return;

    const info = getTurnTileInfo(
      { x: positionX, y: positionY },
      currentDir as Direction,
      mapTiles as TileType[][],
      mapWidth,
      mapHeight
    );

    setTurnTileInfo({
      turnDirection: info.turnDirection,
      connections: info.connections,
    });
  };

  // Run detailed corridor test from current position
  const runCorridorTest = () => {
    if (!mapTiles || mapTiles.length === 0 || !verticalTiles || verticalTiles.length === 0) {
      console.log('Cannot run corridor test - missing map data');
      return;
    }

    const results = testAllDirectionsFromPosition(
      { x: positionX, y: positionY },
      mapTiles as TileType[][],
      verticalTiles as TileType[][],
      mapWidth,
      mapHeight
    );

    setCorridorTestResults(results);
    console.log(formatCorridorTestResults(results));
  };

  // Analyze current view for debugging
  const analyzeCurrentView = useCallback(() => {
    if (!mapTiles || mapTiles.length === 0 || !verticalTiles || verticalTiles.length === 0) {
      console.log('Cannot analyze view - missing map data');
      return;
    }

    const state = analyzeView(
      positionX,
      positionY,
      currentDir as Direction,
      currentArrPos,
      iniDir,
      mapTiles as TileType[][],
      verticalTiles as TileType[][],
      mapWidth,
      mapHeight,
      pathTileArr || []
    );

    setViewDebugState(state);

    if (state.issues.length > 0) {
      console.log('=== VIEW DEBUG ISSUES ===');
      state.issues.forEach(issue => console.log(`  - ${issue}`));
    }
  }, [positionX, positionY, currentDir, currentArrPos, iniDir, mapTiles, verticalTiles, mapWidth, mapHeight, pathTileArr]);

  // Live view debugging - update on every state change
  useEffect(() => {
    if (liveViewDebug && showViewDebug) {
      analyzeCurrentView();
    }
  }, [liveViewDebug, showViewDebug, positionX, positionY, currentDir, currentArrPos, iniDir, pathTileArr, analyzeCurrentView]);

  // Validate current state against expected
  const validateState = useCallback(() => {
    if (!mapTiles || mapTiles.length === 0 || !verticalTiles || verticalTiles.length === 0) {
      console.log('Cannot validate state - missing map data');
      return;
    }

    const result = validateCurrentState(
      { x: positionX, y: positionY },
      currentDir as Direction,
      currentArrPos,
      mapTiles as TileType[][],
      verticalTiles as TileType[][]
    );

    setStateValidation(result);

    if (!result.isValid) {
      console.warn('=== STATE DESYNC DETECTED ===');
      console.warn(result.details);
    } else {
      console.log('State validated OK:', result.details);
    }
  }, [positionX, positionY, currentDir, currentArrPos, mapTiles, verticalTiles]);

  // Run turn desync test from current position
  const runDesyncTest = useCallback(() => {
    if (!mapTiles || mapTiles.length === 0 || !verticalTiles || verticalTiles.length === 0) {
      console.log('Cannot run desync test - missing map data');
      return;
    }

    const result = testTurnDesync(
      { x: positionX, y: positionY },
      currentDir as Direction,
      mapTiles as TileType[][],
      verticalTiles as TileType[][],
      mapWidth,
      mapHeight
    );

    setDesyncTest(result);
    console.log('Turn Desync Test:', result.summary);
  }, [positionX, positionY, currentDir, mapTiles, verticalTiles, mapWidth, mapHeight]);

  // Live state validation
  useEffect(() => {
    if (liveValidation) {
      validateState();
    }
  }, [liveValidation, positionX, positionY, currentDir, currentArrPos, validateState]);

  if (!visible) return null;

  const tileTypeName = movementDebug.getTileTypeName(currentTileType);
  const directionName = movementDebug.getDirectionName(currentDir as 'N' | 'S' | 'E' | 'W');

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setIsExpanded(!isExpanded)}
      >
        <Text style={styles.headerText}>
          DEBUG {isExpanded ? '[-]' : '[+]'}
        </Text>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.content}>
          {/* Map Selector */}
          <View style={styles.section}>
            <View style={styles.historyHeader}>
              <Text style={styles.sectionTitle}>MAP</Text>
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => setShowMapSelector(!showMapSelector)}
              >
                <Text style={styles.clearBtnText}>{showMapSelector ? 'Hide' : 'Change'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.mapName}>{currentMapId} ({mapWidth}x{mapHeight})</Text>
            {showMapSelector && (
              <View style={styles.mapList}>
                {availableMaps.map((map) => (
                  <TouchableOpacity
                    key={map.id}
                    style={[
                      styles.mapItem,
                      map.id === currentMapId && styles.mapItemActive,
                    ]}
                    onPress={() => {
                      dispatch(loadMap(map.id));
                      setShowMapSelector(false);
                    }}
                  >
                    <Text style={styles.mapItemText}>{map.name}</Text>
                    <Text style={styles.mapItemSize}>{map.width}x{map.height}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TouchableOpacity
              style={styles.resetBtn}
              onPress={() => dispatch(resetPosition())}
            >
              <Text style={styles.resetBtnText}>Reset Position</Text>
            </TouchableOpacity>
          </View>

          {/* Map Generator */}
          <View style={styles.section}>
            <View style={styles.historyHeader}>
              <Text style={styles.sectionTitle}>GENERATOR</Text>
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => setShowMapGenerator(!showMapGenerator)}
              >
                <Text style={styles.clearBtnText}>{showMapGenerator ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>

            {showMapGenerator && (
              <View style={styles.generatorPanel}>
                {/* Size inputs */}
                <View style={styles.sizeInputRow}>
                  <Text style={styles.inputLabel}>Size:</Text>
                  <TextInput
                    style={styles.sizeInput}
                    value={genWidth}
                    onChangeText={setGenWidth}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                  <Text style={styles.inputLabel}>x</Text>
                  <TextInput
                    style={styles.sizeInput}
                    value={genHeight}
                    onChangeText={setGenHeight}
                    keyboardType="numeric"
                    maxLength={2}
                  />
                </View>

                {/* Preset buttons */}
                <Text style={styles.subLabel}>Presets:</Text>
                <View style={styles.presetRow}>
                  {Object.keys(PRESETS).map((preset) => (
                    <TouchableOpacity
                      key={preset}
                      style={[
                        styles.presetBtn,
                        selectedPreset === preset && styles.presetBtnActive,
                      ]}
                      onPress={() => setSelectedPreset(preset)}
                    >
                      <Text style={styles.presetBtnText}>{preset}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Generate from preset */}
                <TouchableOpacity
                  style={styles.generateBtn}
                  onPress={() => {
                    const width = parseInt(genWidth) || 8;
                    const height = parseInt(genHeight) || 8;
                    const config = generateFromPreset(
                      selectedPreset as keyof typeof PRESETS,
                      { width, height }
                    );
                    dispatch(loadMapConfig(config));
                    setShowMapGenerator(false);
                  }}
                >
                  <Text style={styles.generateBtnText}>Generate Random</Text>
                </TouchableOpacity>

                {/* Template buttons */}
                <Text style={styles.subLabel}>Templates:</Text>
                <ScrollView style={styles.templateList} horizontal>
                  {templates.map((t) => (
                    <TouchableOpacity
                      key={t.type}
                      style={[
                        styles.templateBtn,
                        selectedTemplate === t.type && styles.templateBtnActive,
                      ]}
                      onPress={() => setSelectedTemplate(t.type)}
                    >
                      <Text style={styles.templateBtnText}>{t.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Generate from template */}
                <TouchableOpacity
                  style={[styles.generateBtn, styles.templateGenerateBtn]}
                  onPress={() => {
                    const width = parseInt(genWidth) || 8;
                    const height = parseInt(genHeight) || 8;
                    const config = generateFromTemplate(selectedTemplate, { width, height });
                    dispatch(loadMapConfig(config));
                    setShowMapGenerator(false);
                  }}
                >
                  <Text style={styles.generateBtnText}>Generate {selectedTemplate}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Movement Tests */}
          <View style={styles.section}>
            <View style={styles.historyHeader}>
              <Text style={styles.sectionTitle}>TESTS</Text>
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => setShowTestPanel(!showTestPanel)}
              >
                <Text style={styles.clearBtnText}>{showTestPanel ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>

            {showTestPanel && (
              <View style={styles.testPanel}>
                {/* Test buttons - Row 1 */}
                <View style={styles.testButtonRow}>
                  <TouchableOpacity
                    style={[styles.testBtn, isRunningTests && styles.testBtnDisabled]}
                    onPress={runTests}
                    disabled={isRunningTests}
                  >
                    <Text style={styles.testBtnText}>Run All Tests</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.testBtn, styles.sequenceBtn, isRunningTests && styles.testBtnDisabled]}
                    onPress={runSequenceTest}
                    disabled={isRunningTests}
                  >
                    <Text style={styles.testBtnText}>Test Sequence</Text>
                  </TouchableOpacity>
                </View>

                {/* Test buttons - Row 2 */}
                <View style={styles.testButtonRow}>
                  <TouchableOpacity
                    style={[styles.testBtn, styles.pathWalkBtn, isRunningTests && styles.testBtnDisabled]}
                    onPress={runPathWalk}
                    disabled={isRunningTests}
                  >
                    <Text style={styles.testBtnText}>Walk All Paths</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.testBtn, styles.turnInfoBtn]}
                    onPress={checkTurnTile}
                  >
                    <Text style={styles.testBtnText}>Check Turn Tile</Text>
                  </TouchableOpacity>
                </View>

                {/* Test buttons - Row 3 */}
                <View style={styles.testButtonRow}>
                  <TouchableOpacity
                    style={[styles.testBtn, styles.corridorTestBtn]}
                    onPress={runCorridorTest}
                  >
                    <Text style={styles.testBtnText}>Test Corridors</Text>
                  </TouchableOpacity>
                </View>

                {/* Test Results */}
                {testResults.length > 0 && (
                  <View style={styles.testResults}>
                    <Text style={styles.testResultsHeader}>
                      Results: {testResults.filter(r => r.passed).length}/{testResults.length} passed
                    </Text>
                    <ScrollView style={styles.testResultsList} nestedScrollEnabled>
                      {testResults.map((result, index) => (
                        <View
                          key={index}
                          style={[
                            styles.testResultItem,
                            result.passed ? styles.testPassed : styles.testFailed,
                          ]}
                        >
                          <Text style={styles.testResultIcon}>
                            {result.passed ? '✓' : '✗'}
                          </Text>
                          <View style={styles.testResultText}>
                            <Text style={styles.testResultName}>{result.name}</Text>
                            <Text style={styles.testResultMessage}>{result.message}</Text>
                          </View>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Sequence Results */}
                {sequenceResults && (
                  <View style={styles.sequenceResults}>
                    <Text style={styles.testResultsHeader}>
                      Sequence: {sequenceResults.states.length} states, {sequenceResults.errors.length} errors
                    </Text>
                    {sequenceResults.errors.length > 0 && (
                      <ScrollView style={styles.errorList} nestedScrollEnabled>
                        {sequenceResults.errors.map((error, index) => (
                          <Text key={index} style={styles.errorText}>{error}</Text>
                        ))}
                      </ScrollView>
                    )}
                    {sequenceResults.errors.length === 0 && (
                      <Text style={styles.successText}>All moves executed successfully!</Text>
                    )}
                  </View>
                )}

                {/* Path Walk Results */}
                {pathWalkResults && (
                  <View style={styles.sequenceResults}>
                    <Text style={styles.testResultsHeader}>
                      Path Walk: {pathWalkResults.visitedCount}/{pathWalkResults.totalWalkable} tiles
                    </Text>
                    {pathWalkResults.errors.length > 0 ? (
                      <ScrollView style={styles.errorList} nestedScrollEnabled>
                        {pathWalkResults.errors.map((error, index) => (
                          <Text key={index} style={styles.errorText}>{error}</Text>
                        ))}
                      </ScrollView>
                    ) : (
                      <Text style={styles.successText}>All tiles reachable, no clipping!</Text>
                    )}
                  </View>
                )}

                {/* Turn Tile Info */}
                {turnTileInfo && (
                  <View style={styles.turnTileInfoBox}>
                    <Text style={styles.testResultsHeader}>Current Turn Tile:</Text>
                    <Text style={[
                      styles.turnDirection,
                      turnTileInfo.turnDirection === 'L' && styles.turnLeft,
                      turnTileInfo.turnDirection === 'R' && styles.turnRight,
                    ]}>
                      Turn: {turnTileInfo.turnDirection.toUpperCase()}
                    </Text>
                    <Text style={styles.turnConnections}>
                      Connections: {turnTileInfo.connections.join(', ') || 'none'}
                    </Text>
                  </View>
                )}

                {/* Corridor Test Results */}
                {corridorTestResults && (
                  <View style={styles.corridorTestBox}>
                    <Text style={styles.testResultsHeader}>Corridor Test from ({positionX}, {positionY}):</Text>
                    <ScrollView style={styles.corridorTestScroll} nestedScrollEnabled>
                      {corridorTestResults.map((result, idx) => (
                        <View key={idx} style={styles.corridorDirResult}>
                          <Text style={[
                            styles.corridorDirHeader,
                            result.issues.length > 0 ? styles.corridorDirError : styles.corridorDirOk
                          ]}>
                            {result.direction}: {result.issues.length > 0 ? `${result.issues.length} issues` : 'OK'}
                          </Text>
                          <Text style={styles.corridorPathText}>
                            Path: [{result.filteredPath.slice(0, 8).join(',')}]{result.filteredPath.length > 8 ? '...' : ''}
                          </Text>
                          <Text style={styles.corridorPathText}>
                            Positions: [{result.positionLookup.slice(0, 8).join(',')}]{result.positionLookup.length > 8 ? '...' : ''}
                          </Text>
                          {result.issues.length > 0 && result.issues.slice(0, 2).map((issue, i) => (
                            <Text key={i} style={styles.corridorIssue}>{issue}</Text>
                          ))}
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Clear results */}
                {(testResults.length > 0 || sequenceResults || pathWalkResults || turnTileInfo || corridorTestResults) && (
                  <TouchableOpacity
                    style={styles.clearResultsBtn}
                    onPress={() => {
                      setTestResults([]);
                      setSequenceResults(null);
                      setPathWalkResults(null);
                      setTurnTileInfo(null);
                      setCorridorTestResults(null);
                    }}
                  >
                    <Text style={styles.clearResultsBtnText}>Clear Results</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* View Debug */}
          <View style={styles.section}>
            <View style={styles.historyHeader}>
              <Text style={styles.sectionTitle}>VIEW DEBUG</Text>
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => setShowViewDebug(!showViewDebug)}
              >
                <Text style={styles.clearBtnText}>{showViewDebug ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>

            {showViewDebug && (
              <View style={styles.viewDebugPanel}>
                {/* Control buttons */}
                <View style={styles.viewDebugControls}>
                  <TouchableOpacity
                    style={styles.analyzeBtn}
                    onPress={analyzeCurrentView}
                  >
                    <Text style={styles.testBtnText}>Analyze View</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.liveToggle, liveViewDebug && styles.liveToggleActive]}
                    onPress={() => setLiveViewDebug(!liveViewDebug)}
                  >
                    <Text style={styles.testBtnText}>
                      Live: {liveViewDebug ? 'ON' : 'OFF'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Current perpendicular info */}
                <View style={styles.perpInfo}>
                  <Text style={styles.perpTitle}>Perpendicular Tiles at Current Position:</Text>
                  {mapTiles && mapTiles.length > 0 && (() => {
                    const perp = getPerpendicularTiles(
                      positionX, positionY, currentDir as Direction,
                      mapTiles as TileType[][], mapWidth, mapHeight
                    );
                    const hasLeft = perp.left !== null && perp.left !== 0;
                    const hasRight = perp.right !== null && perp.right !== 0;
                    const currentTile = mapTiles[positionY]?.[positionX] as TileType;
                    const expected = getExpectedVisual(currentTile, perp, iniDir);

                    return (
                      <>
                        <View style={styles.perpRow}>
                          <Text style={[styles.perpLabel, hasLeft && styles.perpActive]}>
                            LEFT: {perp.left ?? 'null'} {hasLeft ? '(OPEN)' : '(blocked)'}
                          </Text>
                          <Text style={[styles.perpLabel, hasRight && styles.perpActive]}>
                            RIGHT: {perp.right ?? 'null'} {hasRight ? '(OPEN)' : '(blocked)'}
                          </Text>
                        </View>
                        <Text style={styles.expectedVisual}>
                          Current tile: {currentTile} | Expected visual: {expected}
                        </Text>
                      </>
                    );
                  })()}
                </View>

                {/* Rendered tiles info */}
                {pathTileArr && pathTileArr.length > 0 && (
                  <View style={styles.renderedInfo}>
                    <Text style={styles.perpTitle}>Rendered Tiles ({pathTileArr.length}):</Text>
                    <ScrollView style={styles.renderedList} horizontal>
                      {pathTileArr.map((tile, idx) => (
                        <View key={idx} style={styles.renderedTileItem}>
                          <Text style={styles.renderedTileIdx}>{idx}</Text>
                          <Text style={styles.renderedTileName}>
                            {getTileImageName(tile)}
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* State Validation */}
                <View style={styles.stateValidationSection}>
                  <Text style={styles.perpTitle}>State Sync Check:</Text>
                  <View style={styles.viewDebugControls}>
                    <TouchableOpacity
                      style={styles.analyzeBtn}
                      onPress={validateState}
                    >
                      <Text style={styles.testBtnText}>Validate State</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.liveToggle, liveValidation && styles.liveToggleActive]}
                      onPress={() => setLiveValidation(!liveValidation)}
                    >
                      <Text style={styles.testBtnText}>
                        Live: {liveValidation ? 'ON' : 'OFF'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {stateValidation && (
                    <View style={[
                      styles.validationResult,
                      stateValidation.isValid ? styles.validationOk : styles.validationError
                    ]}>
                      <Text style={styles.validationStatus}>
                        {stateValidation.isValid ? 'SYNC OK' : `DESYNC: ${stateValidation.mismatch} off`}
                      </Text>
                      <Text style={styles.validationDetail}>
                        Expected arrPos: {stateValidation.expectedArrPos}
                      </Text>
                      <Text style={styles.validationDetail}>
                        Actual arrPos: {stateValidation.actualArrPos}
                      </Text>
                    </View>
                  )}

                  {/* Desync test button */}
                  <TouchableOpacity
                    style={[styles.testBtn, styles.desyncTestBtn]}
                    onPress={runDesyncTest}
                  >
                    <Text style={styles.testBtnText}>Test Turn Sequence</Text>
                  </TouchableOpacity>

                  {desyncTest && (
                    <View style={[
                      styles.desyncResult,
                      desyncTest.desyncDetected ? styles.validationError : styles.validationOk
                    ]}>
                      <Text style={styles.validationStatus}>
                        {desyncTest.desyncDetected ? 'DESYNC FOUND' : 'No desync detected'}
                      </Text>
                      <ScrollView style={styles.desyncSequence} nestedScrollEnabled>
                        {desyncTest.sequence.map((step, idx) => (
                          <Text
                            key={idx}
                            style={[
                              styles.desyncStep,
                              step.issue ? styles.desyncStepError : null
                            ]}
                          >
                            {`${step.step}: ${step.action} → ${step.direction} (arrPos:${step.expectedArrPos}, len:${step.expectedPathLength})`}
                            {step.issue ? ` [${step.issue}]` : ''}
                          </Text>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* View debug analysis results */}
                {viewDebugState && (
                  <View style={styles.viewAnalysis}>
                    <Text style={styles.perpTitle}>Analysis:</Text>
                    <Text style={styles.analysisPath}>
                      Path: [{viewDebugState.filteredPath.slice(0, 6).join(',')}]
                      {viewDebugState.filteredPath.length > 6 ? '...' : ''}
                    </Text>
                    <Text style={styles.analysisPath}>
                      Positions: [{viewDebugState.positionLookup.slice(0, 6).join(',')}]
                      {viewDebugState.positionLookup.length > 6 ? '...' : ''}
                    </Text>

                    {/* Show each analyzed tile */}
                    <ScrollView style={styles.analyzedTilesList} nestedScrollEnabled>
                      {viewDebugState.renderedTiles.map((tile, idx) => (
                        <View
                          key={idx}
                          style={[
                            styles.analyzedTile,
                            tile.issue ? styles.analyzedTileError : styles.analyzedTileOk
                          ]}
                        >
                          <Text style={styles.analyzedTileHeader}>
                            [{tile.index}] ({tile.mapPosition.x},{tile.mapPosition.y}) type={tile.tileType}
                          </Text>
                          <Text style={styles.analyzedTilePerp}>
                            L:{tile.perpendicular.left ?? 'X'} R:{tile.perpendicular.right ?? 'X'}
                          </Text>
                          <Text style={styles.analyzedTileVisual}>
                            expect: {tile.expectedVisual} | got: {tile.actualVisual}
                          </Text>
                          {tile.issue && (
                            <Text style={styles.analyzedTileIssue}>{tile.issue}</Text>
                          )}
                        </View>
                      ))}
                    </ScrollView>

                    {/* Issues summary */}
                    {viewDebugState.issues.length > 0 && (
                      <View style={styles.issuesSummary}>
                        <Text style={styles.issuesTitle}>
                          ISSUES ({viewDebugState.issues.length}):
                        </Text>
                        {viewDebugState.issues.slice(0, 3).map((issue, idx) => (
                          <Text key={idx} style={styles.issueText}>{issue}</Text>
                        ))}
                        {viewDebugState.issues.length > 3 && (
                          <Text style={styles.issueText}>
                            ... and {viewDebugState.issues.length - 3} more
                          </Text>
                        )}
                      </View>
                    )}

                    {viewDebugState.issues.length === 0 && (
                      <Text style={styles.noIssues}>No issues detected</Text>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Current State */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>STATE</Text>
            <View style={styles.stateGrid}>
              <View style={styles.stateRow}>
                <Text style={styles.label}>Pos:</Text>
                <Text style={styles.value}>({positionX}, {positionY})</Text>
              </View>
              <View style={styles.stateRow}>
                <Text style={styles.label}>Dir:</Text>
                <Text style={styles.value}>{currentDir} ({directionName})</Text>
              </View>
              <View style={styles.stateRow}>
                <Text style={styles.label}>Tile:</Text>
                <Text style={styles.value}>{currentTileType} ({tileTypeName})</Text>
              </View>
              <View style={styles.stateRow}>
                <Text style={styles.label}>ArrPos:</Text>
                <Text style={styles.value}>{currentArrPos} / {mapArray?.length ?? '?'}</Text>
              </View>
              <View style={styles.stateRow}>
                <Text style={styles.label}>IniDir:</Text>
                <Text style={[styles.value, iniDir ? styles.truthy : styles.falsy]}>
                  {iniDir ? 'true (CW)' : 'false (CCW)'}
                </Text>
              </View>
              <View style={styles.stateRow}>
                <Text style={styles.label}>LastTurn:</Text>
                <Text style={styles.value}>{lastTurnDir || '-'}</Text>
              </View>
              <View style={styles.stateRow}>
                <Text style={styles.label}>PathTiles:</Text>
                <Text style={styles.value}>{pathTileArr?.length ?? 0}</Text>
              </View>
            </View>
          </View>

          {/* Movement History */}
          <View style={styles.section}>
            <View style={styles.historyHeader}>
              <Text style={styles.sectionTitle}>HISTORY</Text>
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={() => movementDebug.clearHistory()}
              >
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.historyList} nestedScrollEnabled>
              {history.length === 0 ? (
                <Text style={styles.emptyHistory}>No movements yet</Text>
              ) : (
                history.slice().reverse().map((event, index) => (
                  <View
                    key={event.id}
                    style={[
                      styles.historyItem,
                      event.success ? styles.successItem : styles.failItem,
                    ]}
                  >
                    <Text style={styles.historyText}>
                      {movementDebug.formatEvent(event)}
                    </Text>
                    {event.notes && event.notes.length > 0 && (
                      <Text style={styles.historyNotes}>
                        {event.notes.join(', ')}
                      </Text>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          </View>

          {/* Map Preview */}
          {dg_map && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>MINI-MAP</Text>
              <View style={styles.mapPreview}>
                {dg_map.map((row, y) => (
                  <View key={y} style={styles.mapRow}>
                    {row.map((tile, x) => (
                      <View
                        key={`${x}-${y}`}
                        style={[
                          styles.mapTile,
                          tile === 0 && styles.wallTile,
                          tile === 1 && styles.corridorTile,
                          tile === 2 && styles.turnTile,
                          tile === 3 && styles.threeWayTile,
                          x === positionX && y === positionY && styles.playerTile,
                        ]}
                      >
                        {x === positionX && y === positionY ? (
                          <Text style={styles.playerMarker}>
                            {currentDir === 'N' ? '^' :
                             currentDir === 'S' ? 'v' :
                             currentDir === 'E' ? '>' : '<'}
                          </Text>
                        ) : (
                          <Text style={styles.tileText}>{tile}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 8,
    minWidth: 220,
    maxWidth: 280,
    maxHeight: '90%',
    zIndex: 1000,
  },
  header: {
    padding: 8,
    backgroundColor: 'rgba(50, 50, 50, 0.9)',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  headerText: {
    color: '#00ff00',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 12,
  },
  content: {
    padding: 8,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#ffff00',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 10,
    marginBottom: 4,
  },
  stateGrid: {
    gap: 2,
  },
  stateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    color: '#888888',
    fontFamily: 'monospace',
    fontSize: 10,
  },
  value: {
    color: '#ffffff',
    fontFamily: 'monospace',
    fontSize: 10,
  },
  truthy: {
    color: '#00ff00',
  },
  falsy: {
    color: '#ff6666',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  clearBtn: {
    backgroundColor: '#333',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  clearBtnText: {
    color: '#999',
    fontSize: 9,
    fontFamily: 'monospace',
  },
  historyList: {
    maxHeight: 120,
  },
  historyItem: {
    paddingVertical: 2,
    paddingHorizontal: 4,
    marginVertical: 1,
    borderRadius: 2,
  },
  successItem: {
    backgroundColor: 'rgba(0, 100, 0, 0.3)',
  },
  failItem: {
    backgroundColor: 'rgba(100, 0, 0, 0.3)',
  },
  historyText: {
    color: '#cccccc',
    fontFamily: 'monospace',
    fontSize: 9,
  },
  historyNotes: {
    color: '#888888',
    fontFamily: 'monospace',
    fontSize: 8,
    fontStyle: 'italic',
  },
  emptyHistory: {
    color: '#666666',
    fontFamily: 'monospace',
    fontSize: 9,
    fontStyle: 'italic',
  },
  mapPreview: {
    alignItems: 'center',
  },
  mapRow: {
    flexDirection: 'row',
  },
  mapTile: {
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  wallTile: {
    backgroundColor: '#222',
  },
  corridorTile: {
    backgroundColor: '#444',
  },
  turnTile: {
    backgroundColor: '#664400',
  },
  threeWayTile: {
    backgroundColor: '#006644',
  },
  playerTile: {
    backgroundColor: '#0066ff',
    borderColor: '#00aaff',
    borderWidth: 2,
  },
  tileText: {
    color: '#666',
    fontSize: 8,
    fontFamily: 'monospace',
  },
  playerMarker: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Map selector styles
  mapName: {
    color: '#ffffff',
    fontFamily: 'monospace',
    fontSize: 10,
    marginBottom: 4,
  },
  mapList: {
    marginTop: 4,
    marginBottom: 4,
  },
  mapItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#333',
    padding: 6,
    marginVertical: 2,
    borderRadius: 4,
  },
  mapItemActive: {
    backgroundColor: '#0066aa',
    borderColor: '#00aaff',
    borderWidth: 1,
  },
  mapItemText: {
    color: '#ffffff',
    fontFamily: 'monospace',
    fontSize: 9,
  },
  mapItemSize: {
    color: '#888888',
    fontFamily: 'monospace',
    fontSize: 9,
  },
  resetBtn: {
    backgroundColor: '#663300',
    padding: 4,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 4,
  },
  resetBtnText: {
    color: '#ffcc00',
    fontFamily: 'monospace',
    fontSize: 9,
  },
  // Generator styles
  generatorPanel: {
    marginTop: 4,
    padding: 4,
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    borderRadius: 4,
  },
  sizeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: {
    color: '#888',
    fontFamily: 'monospace',
    fontSize: 9,
    marginRight: 4,
  },
  sizeInput: {
    backgroundColor: '#333',
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: 10,
    width: 30,
    height: 22,
    textAlign: 'center',
    borderRadius: 3,
    marginHorizontal: 2,
    padding: 2,
  },
  subLabel: {
    color: '#888',
    fontFamily: 'monospace',
    fontSize: 8,
    marginTop: 4,
    marginBottom: 2,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 6,
  },
  presetBtn: {
    backgroundColor: '#333',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
  },
  presetBtnActive: {
    backgroundColor: '#0066aa',
  },
  presetBtnText: {
    color: '#ccc',
    fontFamily: 'monospace',
    fontSize: 8,
  },
  generateBtn: {
    backgroundColor: '#006600',
    padding: 6,
    borderRadius: 4,
    alignItems: 'center',
    marginVertical: 4,
  },
  templateGenerateBtn: {
    backgroundColor: '#660066',
  },
  generateBtnText: {
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: 'bold',
  },
  templateList: {
    maxHeight: 30,
    marginBottom: 4,
  },
  templateBtn: {
    backgroundColor: '#333',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 3,
    marginRight: 4,
  },
  templateBtnActive: {
    backgroundColor: '#660066',
  },
  templateBtnText: {
    color: '#ccc',
    fontFamily: 'monospace',
    fontSize: 8,
  },
  // Test panel styles
  testPanel: {
    marginTop: 4,
    padding: 4,
    backgroundColor: 'rgba(30, 30, 30, 0.8)',
    borderRadius: 4,
  },
  testButtonRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 6,
  },
  testBtn: {
    flex: 1,
    backgroundColor: '#004488',
    padding: 6,
    borderRadius: 4,
    alignItems: 'center',
  },
  sequenceBtn: {
    backgroundColor: '#884400',
  },
  testBtnDisabled: {
    opacity: 0.5,
  },
  testBtnText: {
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: 'bold',
  },
  testResults: {
    marginTop: 4,
  },
  testResultsHeader: {
    color: '#ffff00',
    fontFamily: 'monospace',
    fontSize: 9,
    marginBottom: 4,
  },
  testResultsList: {
    maxHeight: 150,
  },
  testResultItem: {
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 4,
    marginVertical: 1,
    borderRadius: 2,
    alignItems: 'flex-start',
  },
  testPassed: {
    backgroundColor: 'rgba(0, 100, 0, 0.4)',
  },
  testFailed: {
    backgroundColor: 'rgba(150, 0, 0, 0.4)',
  },
  testResultIcon: {
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: 10,
    marginRight: 4,
    width: 12,
  },
  testResultText: {
    flex: 1,
  },
  testResultName: {
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: 'bold',
  },
  testResultMessage: {
    color: '#ccc',
    fontFamily: 'monospace',
    fontSize: 8,
  },
  sequenceResults: {
    marginTop: 6,
    padding: 4,
    backgroundColor: 'rgba(40, 40, 40, 0.6)',
    borderRadius: 3,
  },
  errorList: {
    maxHeight: 80,
  },
  errorText: {
    color: '#ff6666',
    fontFamily: 'monospace',
    fontSize: 8,
    marginVertical: 1,
  },
  successText: {
    color: '#66ff66',
    fontFamily: 'monospace',
    fontSize: 9,
  },
  clearResultsBtn: {
    backgroundColor: '#333',
    padding: 4,
    borderRadius: 3,
    alignItems: 'center',
    marginTop: 6,
  },
  clearResultsBtnText: {
    color: '#888',
    fontFamily: 'monospace',
    fontSize: 8,
  },
  pathWalkBtn: {
    backgroundColor: '#448800',
  },
  turnInfoBtn: {
    backgroundColor: '#664488',
  },
  turnTileInfoBox: {
    marginTop: 6,
    padding: 6,
    backgroundColor: 'rgba(60, 40, 80, 0.6)',
    borderRadius: 4,
  },
  turnDirection: {
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 2,
  },
  turnLeft: {
    color: '#ff8844',
  },
  turnRight: {
    color: '#44ff88',
  },
  turnConnections: {
    color: '#aaa',
    fontFamily: 'monospace',
    fontSize: 9,
    textAlign: 'center',
  },
  // Corridor test styles
  corridorTestBtn: {
    backgroundColor: '#666600',
    flex: 1,
  },
  corridorTestBox: {
    marginTop: 6,
    padding: 6,
    backgroundColor: 'rgba(50, 50, 30, 0.6)',
    borderRadius: 4,
  },
  corridorTestScroll: {
    maxHeight: 200,
  },
  corridorDirResult: {
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  corridorDirHeader: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  corridorDirOk: {
    color: '#88ff88',
  },
  corridorDirError: {
    color: '#ff8888',
  },
  corridorPathText: {
    color: '#aaa',
    fontFamily: 'monospace',
    fontSize: 8,
  },
  corridorIssue: {
    color: '#ff6666',
    fontFamily: 'monospace',
    fontSize: 7,
    marginTop: 2,
  },
  // View debug styles
  viewDebugPanel: {
    marginTop: 4,
    padding: 4,
    backgroundColor: 'rgba(30, 40, 50, 0.8)',
    borderRadius: 4,
  },
  viewDebugControls: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 6,
  },
  analyzeBtn: {
    flex: 1,
    backgroundColor: '#005588',
    padding: 6,
    borderRadius: 4,
    alignItems: 'center',
  },
  liveToggle: {
    flex: 1,
    backgroundColor: '#333',
    padding: 6,
    borderRadius: 4,
    alignItems: 'center',
  },
  liveToggleActive: {
    backgroundColor: '#008800',
  },
  perpInfo: {
    backgroundColor: 'rgba(50, 50, 70, 0.6)',
    padding: 4,
    borderRadius: 3,
    marginBottom: 4,
  },
  perpTitle: {
    color: '#aaccff',
    fontFamily: 'monospace',
    fontSize: 8,
    marginBottom: 2,
  },
  perpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  perpLabel: {
    color: '#888',
    fontFamily: 'monospace',
    fontSize: 9,
  },
  perpActive: {
    color: '#88ff88',
    fontWeight: 'bold',
  },
  expectedVisual: {
    color: '#ffcc44',
    fontFamily: 'monospace',
    fontSize: 9,
    marginTop: 2,
  },
  renderedInfo: {
    backgroundColor: 'rgba(50, 60, 50, 0.6)',
    padding: 4,
    borderRadius: 3,
    marginBottom: 4,
  },
  renderedList: {
    maxHeight: 40,
  },
  renderedTileItem: {
    backgroundColor: '#333',
    padding: 3,
    marginRight: 4,
    borderRadius: 2,
    alignItems: 'center',
  },
  renderedTileIdx: {
    color: '#888',
    fontFamily: 'monospace',
    fontSize: 7,
  },
  renderedTileName: {
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: 8,
  },
  viewAnalysis: {
    backgroundColor: 'rgba(40, 40, 60, 0.6)',
    padding: 4,
    borderRadius: 3,
  },
  analysisPath: {
    color: '#aaa',
    fontFamily: 'monospace',
    fontSize: 8,
    marginBottom: 2,
  },
  analyzedTilesList: {
    maxHeight: 150,
    marginTop: 4,
  },
  analyzedTile: {
    padding: 4,
    marginBottom: 3,
    borderRadius: 3,
  },
  analyzedTileOk: {
    backgroundColor: 'rgba(0, 80, 0, 0.4)',
  },
  analyzedTileError: {
    backgroundColor: 'rgba(120, 0, 0, 0.4)',
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  analyzedTileHeader: {
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: 'bold',
  },
  analyzedTilePerp: {
    color: '#aaa',
    fontFamily: 'monospace',
    fontSize: 8,
  },
  analyzedTileVisual: {
    color: '#88ccff',
    fontFamily: 'monospace',
    fontSize: 8,
  },
  analyzedTileIssue: {
    color: '#ff6666',
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: 'bold',
    marginTop: 2,
  },
  issuesSummary: {
    marginTop: 6,
    padding: 4,
    backgroundColor: 'rgba(100, 0, 0, 0.4)',
    borderRadius: 3,
  },
  issuesTitle: {
    color: '#ff8888',
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  issueText: {
    color: '#ff6666',
    fontFamily: 'monospace',
    fontSize: 7,
    marginVertical: 1,
  },
  noIssues: {
    color: '#88ff88',
    fontFamily: 'monospace',
    fontSize: 9,
    marginTop: 4,
    textAlign: 'center',
  },
  // State validation styles
  stateValidationSection: {
    backgroundColor: 'rgba(50, 30, 50, 0.6)',
    padding: 4,
    borderRadius: 3,
    marginBottom: 4,
  },
  validationResult: {
    padding: 6,
    borderRadius: 4,
    marginVertical: 4,
  },
  validationOk: {
    backgroundColor: 'rgba(0, 100, 0, 0.5)',
    borderWidth: 1,
    borderColor: '#44ff44',
  },
  validationError: {
    backgroundColor: 'rgba(150, 0, 0, 0.5)',
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  validationStatus: {
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 2,
  },
  validationDetail: {
    color: '#ddd',
    fontFamily: 'monospace',
    fontSize: 9,
    textAlign: 'center',
  },
  desyncTestBtn: {
    backgroundColor: '#884400',
    marginTop: 4,
  },
  desyncResult: {
    padding: 4,
    borderRadius: 3,
    marginTop: 4,
  },
  desyncSequence: {
    maxHeight: 100,
    marginTop: 4,
  },
  desyncStep: {
    color: '#ccc',
    fontFamily: 'monospace',
    fontSize: 8,
    marginVertical: 1,
  },
  desyncStepError: {
    color: '#ff8888',
    fontWeight: 'bold',
  },
});

export default DebugOverlay;
