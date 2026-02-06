import { createSlice, current, PayloadAction } from '@reduxjs/toolkit';
import data from '../../data/rooms.json';
import { MapConfig, TileType, Direction, Position } from '../../types/map';
import { getDefaultMap, getMap } from '../../data/maps';
import { transposeMap } from '../../utils/mapLoader';

// Load default map
const defaultMapState = getDefaultMap();

interface RoomState {
    // Legacy fields (kept for compatibility)
    currentLvlIndex: number;
    currentLvl: number;
    verticalRes?: NodeRequire[];
    horizontalRes?: NodeRequire[];

    // Movement state
    initialDirection: boolean; // true = clockwise, false = counter-clockwise
    direction: string; // N S W E
    posX: number;
    posY: number;
    currentArrPos: number;
    lastTurnDir: string;

    // Map state (new)
    currentMapId: string;
    mapWidth: number;
    mapHeight: number;
    mapTiles: TileType[][];        // [y][x] horizontal array
    verticalTiles: TileType[][];   // [x][y] vertical array (transposed)

    // Explored tiles tracking for minimap
    exploredTiles: { [key: string]: boolean }; // "x,y" -> true if explored
}

const roomInitialState: RoomState = {
    // Legacy
    currentLvlIndex: 0,
    currentLvl: data.rooms[0].id,
    verticalRes: [],
    horizontalRes: [],

    // Movement - use map's start position/direction
    initialDirection: false,
    direction: defaultMapState.config.startDirection,
    posX: defaultMapState.config.startPosition.x,
    posY: defaultMapState.config.startPosition.y,
    currentArrPos: 0,
    lastTurnDir: '',

    // Map data
    currentMapId: defaultMapState.config.id,
    mapWidth: defaultMapState.config.width,
    mapHeight: defaultMapState.config.height,
    mapTiles: defaultMapState.horizontalArray,
    verticalTiles: defaultMapState.verticalArray,

    // Explored tiles - start with the initial position explored
    exploredTiles: {
        [`${defaultMapState.config.startPosition.x},${defaultMapState.config.startPosition.y}`]: true
    },
}

const roomSlice = createSlice ({
    name: 'room',
    initialState: roomInitialState,
    reducers: {
        // Load a new map by ID
        loadMap(state, action: PayloadAction<string>) {
            try {
                const mapState = getMap(action.payload);
                state.currentMapId = mapState.config.id;
                state.mapWidth = mapState.config.width;
                state.mapHeight = mapState.config.height;
                state.mapTiles = mapState.horizontalArray;
                state.verticalTiles = mapState.verticalArray;

                // Reset position to map's start
                state.posX = mapState.config.startPosition.x;
                state.posY = mapState.config.startPosition.y;
                state.direction = mapState.config.startDirection;
                state.currentArrPos = 0;
                state.lastTurnDir = '';
                state.initialDirection = false;

                // Reset explored tiles with starting position
                state.exploredTiles = {
                    [`${mapState.config.startPosition.x},${mapState.config.startPosition.y}`]: true
                };

                console.log(`[RoomSlice] Loaded map: ${mapState.config.name}`);
            } catch (error) {
                console.error('[RoomSlice] Failed to load map:', error);
            }
        },

        // Load map from raw config (for custom/generated maps)
        loadMapConfig(state, action: PayloadAction<MapConfig>) {
            const config = action.payload;
            state.currentMapId = config.id;
            state.mapWidth = config.width;
            state.mapHeight = config.height;
            state.mapTiles = config.tiles;
            state.verticalTiles = transposeMap(config.tiles);

            // Reset position
            state.posX = config.startPosition.x;
            state.posY = config.startPosition.y;
            state.direction = config.startDirection;
            state.currentArrPos = 0;
            state.lastTurnDir = '';
            state.initialDirection = false;

            // Reset explored tiles with starting position
            state.exploredTiles = {
                [`${config.startPosition.x},${config.startPosition.y}`]: true
            };

            console.log(`[RoomSlice] Loaded custom map: ${config.name}`);
        },

        // Legacy - keep for compatibility
        changeRoom(state, action: PayloadAction<number>) {
            state.currentLvlIndex = action.payload;
            state.currentLvl = data.rooms[action.payload].id;
        },

        changeDir(state, action: PayloadAction<string>) {
            state.direction = action.payload;
        },

        changeX(state, action: PayloadAction<number>) {
            state.posX = action.payload;
        },

        changeY(state, action: PayloadAction<number>) {
            state.posY = action.payload;
        },

        setVertRes(state, action: PayloadAction<NodeRequire[]>) {
            state.verticalRes = action.payload;
        },

        setHorzRes(state, action: PayloadAction<NodeRequire[]>) {
            state.horizontalRes = action.payload;
        },

        setCurrentPos(state, action: PayloadAction<number[]>) {
            state.posX = action.payload[0];
            state.posY = action.payload[1];
            // Mark new position as explored
            state.exploredTiles[`${action.payload[0]},${action.payload[1]}`] = true;
        },

        // Mark a specific tile as explored
        markTileExplored(state, action: PayloadAction<{x: number, y: number}>) {
            const { x, y } = action.payload;
            state.exploredTiles[`${x},${y}`] = true;
        },

        setCurrentArrPos(state, action: PayloadAction<number>) {
            state.currentArrPos = action.payload;
        },

        invertInitialDirection(state) {
            state.initialDirection = !state.initialDirection;
        },

        setInitialDirection(state, action: PayloadAction<boolean>) {
            state.initialDirection = action.payload;
        },

        setLastTurnDir(state, action: PayloadAction<string>) {
            state.lastTurnDir = action.payload;
        },

        // Reset to map's start position
        resetPosition(state) {
            try {
                const mapState = getMap(state.currentMapId);
                state.posX = mapState.config.startPosition.x;
                state.posY = mapState.config.startPosition.y;
                state.direction = mapState.config.startDirection;
                state.currentArrPos = 0;
                state.lastTurnDir = '';
                state.initialDirection = false;
            } catch {
                // Fallback to (0,0) N
                state.posX = 0;
                state.posY = 0;
                state.direction = 'N';
                state.currentArrPos = 0;
                state.lastTurnDir = '';
                state.initialDirection = false;
            }
        },
    }
})

export const {
    loadMap,
    loadMapConfig,
    changeRoom,
    changeDir,
    changeX,
    changeY,
    setCurrentPos,
    setHorzRes,
    setVertRes,
    setCurrentArrPos,
    invertInitialDirection,
    setLastTurnDir,
    setInitialDirection,
    resetPosition,
    markTileExplored,
} = roomSlice.actions;

export default roomSlice.reducer;
