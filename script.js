// ゲームの状態を管理
const gameState = {
    currentStage: 0,
    computerLoseCount: 0,
    isTransitioning: false,
    maxLoseCount: 5,
    characterStates: [
        'clothed.png',      // 服を着た状態（初期状態）
        'topoff.png',       // 上着を脱いだ状態（1回目の負け）
        'skirtoff.png',     // スカートを脱いだ状態（2回目の負け）
        'topless.png',      // トップレス（3回目の負け）
        'naked.png',        // 全裸（4回目の負け）
        'intimate.png'      // エッチ（5回目の負け）
    ],
    expressions: {
        normal: 'normal.png',
        win: 'win.png',
        lose: 'lose.png'
    }
};

// タイミング設定
const timing = {
    afterResultWait: 3000,     // 結果表示後の待機時間
    fadeOutDuration: 1000,     // フェードアウトの時間
    fadeInDuration: 1000,      // フェードインの時間
    fullscreenDuration: 5000,  // フルスクリーン表示の維持時間
    finalSceneWait: 2000       // 最終シーン表示時間
};

// UI要素
const ui = {
    stageDots: document.querySelectorAll('.stage-dot'),
    characterImage: document.getElementById('character-state'),
    characterContainer: document.querySelector('.main-character'),
    expressions: {
        normal: document.getElementById('expression-normal'),
        win: document.getElementById('expression-win'),
        lose: document.getElementById('expression-lose')
    },
    message: document.getElementById('message'),
    buttons: document.querySelectorAll('.choice-btn')
};

// 音声ファイル
const audio = {
    win: new Audio('assets/win.wav'),
    lose: new Audio('assets/lose.wav'),
    draw: new Audio('assets/draw.wav'),
    scenes: [
        new Audio('assets/scene1.wav'),
        new Audio('assets/scene2.wav'),
        new Audio('assets/scene3.wav'),
        new Audio('assets/scene4.wav'),
        new Audio('assets/scene5.wav'),
        new Audio('assets/scene6.wav')
    ]
};

// 音声の再生
async function playSound(audioElement) {
    try {
        audioElement.currentTime = 0;
        await audioElement.play();
        return new Promise(resolve => {
            audioElement.onended = () => {
                resolve();
            };
        });
    } catch (error) {
        console.error('音声再生エラー:', error);
    }
}

// キャッシュ防止のためのタイムスタンプを追加
function getImageUrl(filename) {
    return `assets/${filename}?t=${Date.now()}`;
}

// アニメーション付きで画像を更新
async function updateCharacterState(newStage) {
    console.log(`画像更新開始 - ステージ ${newStage}`);

    // フェードアウト
    ui.characterImage.style.opacity = '0';
    await new Promise(resolve => setTimeout(resolve, timing.fadeOutDuration));

    // 画像のソースを更新
    const newSrc = getImageUrl(gameState.characterStates[newStage]);
    ui.characterImage.src = newSrc;

    // 画像の読み込みを待つ
    await new Promise((resolve) => {
        if (ui.characterImage.complete) {
            resolve();
        } else {
            ui.characterImage.onload = resolve;
        }
    });

    // フルスクリーン表示を開始
    ui.characterContainer.classList.add('fullscreen');
    
    // フェードイン
    ui.characterImage.style.opacity = '1';
    await new Promise(resolve => setTimeout(resolve, timing.fadeInDuration));

    // フルスクリーン表示を維持
    await new Promise(resolve => setTimeout(resolve, timing.fullscreenDuration));

    // 通常表示に戻る
    ui.characterContainer.classList.remove('fullscreen');

    console.log('画像の切り替え完了');
}

// 進捗表示の更新
function updateProgress() {
    ui.stageDots.forEach((dot, index) => {
        dot.classList.remove('active', 'completed');
        if (index < gameState.currentStage) {
            dot.classList.add('completed');
        } else if (index === gameState.currentStage) {
            dot.classList.add('active');
        }
    });
}

// ゲームのリセット
async function resetGame() {
    gameState.currentStage = 0;
    gameState.computerLoseCount = 0;
    gameState.isTransitioning = false;
    
    ui.characterImage.src = getImageUrl(gameState.characterStates[0]);
    updateExpression('normal');
    ui.message.textContent = 'じゃんけんを選んでください';
    
    updateProgress();
    enableButtons();
}

// キャラクター名を読み込んでタイトルを設定
async function loadCharacterName() {
    try {
        const response = await fetch('name.txt');
        if (!response.ok) throw new Error('名前の読み込みに失敗しました');
        const name = await response.text();
        const characterName = name.trim();
        
        const titleElement = document.getElementById('game-title');
        if (titleElement) {
            titleElement.textContent = `${characterName}ちゃんと野球拳`;
        }
        return characterName;
    } catch (error) {
        console.error('キャラクター名の読み込みエラー:', error);
        const titleElement = document.getElementById('game-title');
        if (titleElement) {
            titleElement.textContent = '野球拳ゲーム';
        }
        return '野球拳';
    }
}

// シーン移行処理
async function processLoseSequence() {
    try {
        const nextStage = gameState.currentStage + 1;
        console.log(`ステージ ${nextStage} の処理開始`);
            
        // シーン音声を再生
        await playSound(audio.scenes[gameState.currentStage]);

        // 画像を更新してフルスクリーン表示
        await updateCharacterState(nextStage);
        
        // ステージを更新
        gameState.currentStage = nextStage;
        updateProgress();

        // 最終シーンの場合、しばらく表示してからゲームクリア
        if (gameState.computerLoseCount >= gameState.maxLoseCount) {
            await new Promise(resolve => setTimeout(resolve, timing.finalSceneWait));
            handleGameClear();
            return;
        }

    } catch (error) {
        console.error('シーケンス処理エラー:', error);
    } finally {
        if (gameState.computerLoseCount < gameState.maxLoseCount) {
            gameState.isTransitioning = false;
            enableButtons();
            console.log('シーケンス処理完了');
        }
    }
}

// ゲームの進行処理
async function handleGameProgress(result) {
    if (gameState.isTransitioning) {
        console.log('処理中は操作を受け付けません');
        return;
    }

    try {
        gameState.isTransitioning = true;
        disableButtons();
        updateExpression(result);

        if (result === 'playerWin') {
            gameState.computerLoseCount++;  // ここでインクリメント
            ui.message.textContent = 'You Win!';
            await playSound(audio.lose);
            await new Promise(resolve => setTimeout(resolve, timing.afterResultWait));
            await processLoseSequence();
        } else if (result === 'computerWin') {
            ui.message.textContent = 'You Lose!';
            await playSound(audio.win);
            await new Promise(resolve => setTimeout(resolve, timing.afterResultWait));
            gameState.isTransitioning = false;
            enableButtons();
        } else {
            ui.message.textContent = 'Draw!';
            await playSound(audio.draw);
            await new Promise(resolve => setTimeout(resolve, timing.afterResultWait));
            gameState.isTransitioning = false;
            enableButtons();
        }

    } catch (error) {
        console.error('ゲーム進行エラー:', error);
        gameState.isTransitioning = false;
        enableButtons();
    }
}

// じゃんけんの勝敗判定
function determineWinner(playerChoice, computerChoice) {
    if (playerChoice === computerChoice) return 'draw';
    if (
        (playerChoice === 'rock' && computerChoice === 'scissors') ||
        (playerChoice === 'paper' && computerChoice === 'rock') ||
        (playerChoice === 'scissors' && computerChoice === 'paper')
    ) {
        return 'playerWin';
    }
    return 'computerWin';
}

// 表情の更新
function updateExpression(result) {
    Object.keys(ui.expressions).forEach(exp => {
        ui.expressions[exp].classList.remove('active');
    });
    
    switch(result) {
        case 'playerWin':
            ui.expressions.lose.classList.add('active');
            break;
        case 'computerWin':
            ui.expressions.win.classList.add('active');
            break;
        default:
            ui.expressions.normal.classList.add('active');
    }
}

// ボタンの有効/無効切り替え
function disableButtons() {
    ui.buttons.forEach(button => {
        button.disabled = true;
        button.classList.add('disabled');
    });
}

function enableButtons() {
    if (gameState.isTransitioning) return;
    ui.buttons.forEach(button => {
        button.disabled = false;
        button.classList.remove('disabled');
    });
}

// ゲームクリア処理
function handleGameClear() {
    ui.message.textContent = 'おめでとうございます！全ての服を脱がせることができました！もう一度プレイするには画面をクリックしてください';
    ui.message.classList.add('game-clear');
    document.addEventListener('click', () => {
        ui.message.classList.remove('game-clear');
        resetGame();
    }, { once: true });
}

// プレイヤーの選択を処理
function handlePlayerChoice(choice) {
    if (gameState.isTransitioning) {
        console.log('処理中は選択できません');
        return;
    }
    
    const choices = ['rock', 'paper', 'scissors'];
    const computerChoice = choices[Math.floor(Math.random() * choices.length)];
    const result = determineWinner(choice, computerChoice);
    
    handleGameProgress(result);
}

// イベントリスナーの設定
ui.buttons.forEach(button => {
    button.addEventListener('click', () => handlePlayerChoice(button.id));
});

// 初期化の実行
document.addEventListener('DOMContentLoaded', async () => {
    await loadCharacterName();
    await resetGame();
});