// If you can read this code, you could
// probably use a free cup of coffee

var your_drink;

var reverse = function (s) {
    return s.split("").reverse().join("");
};

var barista = {
    str1: "ers",
    str2: reverse("rap"),
    str3: "amet",
    request: function (preference) {
        return preference + ".Secret.word: " + this.str2 + this.str3 + this.str1;
    }
};

your_drink = "coffee"; // Assign a value to your_drink

console.log(barista.request(your_drink)); // 출력하기 위해 console.log를 사용합니다.
