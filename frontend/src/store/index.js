import { configureStore, createSlice } from '@reduxjs/toolkit';

const audioSlice = createSlice({
  name: 'audio',
  initialState: {
    isRecording: false,
    volume: 0,
    logs: [],
  },
  reducers: {
    setIsRecording: (state, action) => {
      state.isRecording = action.payload;
    },
    setVolume: (state, action) => {
      state.volume = action.payload;
    },
    addLog: (state, action) => {
      state.logs.unshift(action.payload);
    },
    clearLogs: (state) => {
      state.logs = [];
    }
  }
});

export const { setIsRecording, setVolume, addLog, clearLogs } = audioSlice.actions;

export const store = configureStore({
  reducer: {
    audio: audioSlice.reducer,
  }
});
