import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


data = pd.read_csv("train.csv")


print(data.head())


data.drop(
    ["Row ID", "Order ID", "Customer ID", "Customer Name", "Product ID"],
    axis=1,
    inplace=True
)


data["Order Date"] = pd.to_datetime(
    data["Order Date"],
    dayfirst=True
)

data["Ship Date"] = pd.to_datetime(
    data["Ship Date"],
    dayfirst=True
)
data["Order_Year"] = data["Order Date"].dt.year

data["Order_Month"] = data["Order Date"].dt.month

data["Ship_Days"] = (data["Ship Date"] - data["Order Date"]).dt.days


data.drop(
    ["Order Date", "Ship Date"],
    axis=1,
    inplace=True
)



categorical_columns = data.select_dtypes(
    include=["object", "string"]
).columns


numerical_columns = data.select_dtypes(
    include=["number"]
).columns



for column in categorical_columns:
    data[column] = data[column].fillna(
        data[column].mode()[0]
    )


for column in numerical_columns:
    data[column] = data[column].fillna(
        data[column].median()
    )



encoder = LabelEncoder()


for column in categorical_columns:
    data[column] = encoder.fit_transform(
        data[column].astype(str)
    )



print("\nAfter Encoding:")
print(data.head())



X = data.drop(
    "Sales",
    axis=1
)

y = data["Sales"]



X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)



scaler = StandardScaler()


X_train = scaler.fit_transform(X_train)

X_test = scaler.transform(X_test)



model = LinearRegression()


model.fit(
    X_train,
    y_train
)



y_pred = model.predict(X_test)



print("\nMean Absolute Error:")
print(mean_absolute_error(y_test,y_pred))


print("\nMean Squared Error:")
print(mean_squared_error(y_test,y_pred))


print("\nR2 Score:")
print(r2_score(y_test,y_pred)*100)



sample = X_test[0].reshape(1,-1)


prediction = model.predict(sample)


print("\nFuture Sales Prediction:")
print(prediction[0])
