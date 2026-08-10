import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix

data = pd.read_csv("train.csv")

print(data.head())

X = data.drop("price_range", axis=1)

y = data["price_range"]

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)

model = RandomForestClassifier(
    n_estimators=100,
    random_state=42
)

model.fit(X_train, y_train)

y_pred = model.predict(X_test)

accuracy = accuracy_score(y_test, y_pred)

print("\nAccuracy:")
print(accuracy * 100)

print("\nConfusion Matrix:")
print(confusion_matrix(y_test, y_pred))


sample = pd.DataFrame({
    "battery_power": [842],
    "blue": [0],
    "clock_speed": [2.2],
    "dual_sim": [0],
    "fc": [1],
    "four_g": [0],
    "int_memory": [7],
    "m_dep": [0.6],
    "mobile_wt": [188],
    "n_cores": [2],
    "pc": [2],
    "px_height": [20],
    "px_width": [756],
    "ram": [2549],
    "sc_h": [9],
    "sc_w": [7],
    "talk_time": [19],
    "three_g": [0],
    "touch_screen": [0],
    "wifi": [1]
})

prediction = model.predict(sample)

print("\nPrediction:")
print(prediction[0])
