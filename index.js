var rp = require('request-promise');
var server = require('http').createServer();
var io = require('socket.io')(server);
var moment = require('moment');


console.log();

server.listen(3000);
io.on('connection', function(socket){
	socket.emit('connected', true);
	console.log('User Connected: ' + socket.id);

	socket.on('disconnect', function(){
		console.log('Ended connection');
	});

	socket.on('auth player', function(data) {
		console.log("[!] Auth Player!");
		player = trivia.authPlayer(data);
		socket.emit('login success', player);
		trivia.emitLeaderboard();
		trivia.gameInProgress();

		io.to(socket.id).emit('info', `${player.name}, welcome to the game!`);
		console.log(socket.rooms);
	});

	socket.on('add player', function(data){
		socket.emit('login success', trivia.addPlayer(data));
		trivia.gameInProgress();
	});

	socket.on('message', function(data){
		trivia.listen(data, socket.id);
	})

	socket.on('error', (error) => {
		console.log(error);
	});
});

class Trivia {
	constructor() {
		console.log('[!] Trivia App is running!');
		this.inProgress = false;
		this.timer;
		this.players = {};
		this.playerCount = 0; // count of total players joined, not active players
		this.activePlayerCount = 0; // count of players currently connected
		this.winningSocket = null;
		this.questions;
		this.activeQuestion;
		this.apOptions = {
			uri: Trivia.TRIVIA_URL,
			headers: {
				'User-Agent': 'Request-Promise'
			},
			json: true
		};
	}

	static get TRIVIA_URL() {
		//Possible variations >> https://opentdb.com/api.php?amount=10&difficulty=easy&type=boolean
		return 'https://opentdb.com/api.php?amount=10&difficulty=easy&category=14';
	}

	static get MAX_NAME_LENGTH() {
		return 22;
	}

	getQuestions() {
		rp(this.apOptions)
			.then((resp) => {
				this.questions = resp.results;
				this.askQuestion();
			})
			.catch(function (err) {
				console.log(err);
			});
	}

	addPlayer(player) {
		this.playerCount++;
		this.players[player.id] = {
			id: player.id,
			socketID: player.socketID,
			createdTime: new Date().getTime(),
			lastActiveTime: new Date().getTime(),
			lastWinTime: 0,
			clientIp: player.clientIp || '',
			points: 0,
			origName: player.name,
			name: this.normalizePlayerName(player.name) || 'Player_' + this.playerCount
		}
		return this.players[player.id];
	}

	authPlayer(player) {
		console.log("[!] authPlayer");
		if(this.players[player.id] === undefined) {
			return this.addPlayer(player);
		} else {
			this.players[player.id].socketID = player.socketID;
			return this.players[player.id];
		}
	}

	normalizePlayerName(name) {
		name = name || '';
		name = name.trim().replace(/\s+/g,'_');
		name = name.replace(/\W/g,'');
		if (name.length > Trivia.MAX_NAME_LENGTH) {
			name = name.substring(0,Trivia.MAX_NAME_LENGTH-1) + '_';
		}
		console.log(`Name set to: ${name}`);
		return name;
	}

	listen(data, socketID) {
		console.log("Listen: " + data);
		if(this.inProgress === true) {
			this.answer(data);
		} else {
			if(data.msg === 'play') {
				this.play();
			} else {

			}
		}
	}

	answer(data) {
		console.log('Answer: '+data.msg);
		if(data.msg.toUpperCase() == this.activeQuestion.correct_answer.toUpperCase()) {
			io.emit('answer correct', `<strong>${data.player.name}</strong> got it right!`);
			this.awardPoints(data.player);
			this.nextQuestion();
		} else {
			io.emit('answer incorrect', `Sorry <strong>${data.player.name}</strong>. It isn't <u>${data.msg}</u>`);
			console.log(this.activeQuestion);
		}
	}

	awardPoints(player) {
		this.players[player.id].points += 5;
		this.emitLeaderboard();
	}

	play() {
		console.log('Game is trying to start.');
		if(this.inProgress === false) {
			this.startGame();
		} else {
			io.emit('error', {
				type : 'err',
				msg : 'Game is already in progress, you idiot!'
			});
		}
	}

	startGame() {
		this.inProgress = true;
		this.getQuestions();
	}

	askQuestion() {
		if(this.questions.length == 0) {
			console.log('No Questions');
			return false;
		}
		this.activeQuestion = this.questions[0];
		io.emit('ask question', this.activeQuestion);
		console.log('Message dispatched!');
	}

	nextQuestion() {
		this.questions.shift();
		this.activeQuestion = this.questions[0];
		clearTimeout(this.timer);
		this.timer = setTimeout(() => {
			this.askQuestion()
		}, 5000);
	}

	gameInProgress() {
		console.log("[!] Game in progress?: "+this.inProgress);
		if(this.inProgress === true) {
			this.askQuestion();
		}
	}

	emitLeaderboard() {
		io.emit('leaderboard', this.players);
	}
}

var trivia = new Trivia();
